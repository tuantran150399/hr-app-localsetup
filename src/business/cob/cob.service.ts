import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { CobEntry, CobType, CobStatus } from '../../models/cob-entry.entity';
import { CostEntry } from '../../models/cost-entry.entity';
import { RevenueEntry, AccountingStatus, PaymentStatus } from '../../models/revenue-entry.entity';
import { Job } from '../../models/job.entity';
import { CreateCobDto, MarkCostAsCobDto, CobFilterDto } from './dto/cob.dto';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { paginate, getSkip } from '../../common/utils/pagination.util';
import { CustomerDebtService } from '../customer-debt/customer-debt.service';

@Injectable()
export class CobService {
  constructor(
    @InjectRepository(CobEntry) private cobRepo: Repository<CobEntry>,
    @InjectRepository(CostEntry) private costRepo: Repository<CostEntry>,
    @InjectRepository(RevenueEntry) private revenueRepo: Repository<RevenueEntry>,
    @InjectRepository(Job) private jobRepo: Repository<Job>,
    private dataSource: DataSource,
    private auditSvc: AuditLogsService,
    private customerDebtService: CustomerDebtService,
  ) {}

  // ─── Charge-on-behalf ────────────────────────────────────────────────────

  async findCob(filter: CobFilterDto = {}) {
    const { page = 1, limit = 50, status } = filter;
    const qb = this.cobRepo.createQueryBuilder('c')
      .where('c.type = :type', { type: CobType.CHARGE_ON_BEHALF });
    if (status) qb.andWhere('c.status = :status', { status });
    qb.orderBy('c.createdAt', 'DESC').skip(getSkip(page, limit)).take(limit);
    return paginate(await qb.getManyAndCount(), page, limit);
  }

  async createCob(dto: CreateCobDto, userId: number) {
    if (!dto.jobId) {
      throw new BadRequestException('Job is required for charge-on-behalf');
    }

    const job = await this.jobRepo.findOne({ where: { id: dto.jobId } });
    if (!job) {
      throw new NotFoundException('Job not found');
    }
    if (job.partnerId !== dto.partnerId) {
      throw new BadRequestException('The selected job does not belong to the selected customer');
    }

    const entry = this.cobRepo.create({
      type: CobType.CHARGE_ON_BEHALF,
      partnerId: dto.partnerId,
      vendorId: dto.vendorId,
      jobId: dto.jobId,
      currency: dto.currency || 'VND',
      amount: dto.amount,
      description: dto.description,
      paymentMethod: dto.paymentMethod || null,
      status: CobStatus.OPEN,
      createdBy: userId,
      updatedBy: userId,
    });

    const saved = await this.cobRepo.save(entry);

    // Auto-create a receivable from the customer
    const receivable = await this.createAutoReceivable(saved, userId);
    saved.receivableEntryId = receivable.id;
    await this.cobRepo.save(saved);

    const collectEntry = await this.createPairedCollectEntry(saved, userId);
    saved.relatedCobEntryId = collectEntry.id;
    await this.cobRepo.save(saved);

    await this.auditSvc.log({
      entityName: 'CobEntry', entityId: saved.id, action: 'CREATE_COB', userId,
      newValues: { partnerId: dto.partnerId, amount: dto.amount, receivableId: receivable.id, collectEntryId: collectEntry.id },
    });

    await this.customerDebtService.refreshPartnerActualDebt(saved.partnerId);

    return { ...saved, receivable, collectEntry };
  }

  /** Mark an existing cost entry as charge-on-behalf */
  async markCostAsCob(costId: number, dto: MarkCostAsCobDto, userId: number) {
    const cost = await this.costRepo.findOne({ where: { id: costId } });
    if (!cost) throw new NotFoundException('Cost entry not found');
    if (cost.status !== AccountingStatus.POSTED) {
      throw new BadRequestException('Only POSTED cost entries can be marked as COB');
    }
    const existing = await this.cobRepo.findOne({
      where: { costEntryId: costId, type: CobType.CHARGE_ON_BEHALF },
    });
    if (existing) {
      throw new BadRequestException('This cost entry is already marked as COB');
    }

    const entry = this.cobRepo.create({
      type: CobType.CHARGE_ON_BEHALF,
      partnerId: dto.partnerId,
      vendorId: cost.vendorId,
      jobId: cost.jobId,
      costEntryId: cost.id,
      currency: cost.currency,
      amount: cost.amount,
      description: `COB from cost: ${cost.description}`,
      status: CobStatus.OPEN,
      createdBy: userId,
      updatedBy: userId,
    });

    const saved = await this.cobRepo.save(entry);

    // Auto-create a receivable from the customer
    const receivable = await this.createAutoReceivable(saved, userId);
    saved.receivableEntryId = receivable.id;
    await this.cobRepo.save(saved);

    const collectEntry = await this.createPairedCollectEntry(saved, userId);
    saved.relatedCobEntryId = collectEntry.id;
    await this.cobRepo.save(saved);

    await this.auditSvc.log({
      entityName: 'CobEntry', entityId: saved.id, action: 'MARK_COST_AS_COB', userId,
      newValues: { costId, partnerId: dto.partnerId, receivableId: receivable.id, collectEntryId: collectEntry.id },
    });

    await this.customerDebtService.refreshPartnerActualDebt(saved.partnerId);

    return { cobEntry: saved, receivable, collectEntry };
  }

  async settleCob(id: number, userId: number) {
    const entry = await this.findOneOrFail(id);
    if (entry.status === CobStatus.SETTLED) {
      throw new BadRequestException('Entry is already settled');
    }
    if (entry.status === CobStatus.VOIDED) {
      throw new BadRequestException('Entry is already voided');
    }
    if (entry.billedDebitNoteId) {
      throw new BadRequestException('This charge-on-behalf is included in a Debit Note and must be paid from the Debit Note');
    }
    entry.status = CobStatus.SETTLED;
    entry.settledAt = new Date();
    entry.settledBy = userId;
    entry.updatedBy = userId;
    const saved = await this.cobRepo.save(entry);
    if (entry.receivableEntryId) {
      await this.revenueRepo.update(entry.receivableEntryId, { paymentStatus: PaymentStatus.PAID, updatedBy: userId });
    }
    await this.customerDebtService.refreshPartnerActualDebt(entry.partnerId);
    await this.auditSvc.log({ entityName: 'CobEntry', entityId: id, action: 'SETTLE', userId });
    return saved;
  }

  // ─── Collect-on-behalf ───────────────────────────────────────────────────

  async findCollect(filter: CobFilterDto = {}) {
    const { page = 1, limit = 50, status } = filter;
    const qb = this.cobRepo.createQueryBuilder('c')
      .where('c.type = :type', { type: CobType.COLLECT_ON_BEHALF });
    if (status) qb.andWhere('c.status = :status', { status });
    qb.orderBy('c.createdAt', 'DESC').skip(getSkip(page, limit)).take(limit);
    return paginate(await qb.getManyAndCount(), page, limit);
  }

  async createCollect(dto: CreateCobDto, userId: number) {
    const entry = this.cobRepo.create({
      type: CobType.COLLECT_ON_BEHALF,
      partnerId: dto.partnerId,
      vendorId: dto.vendorId,
      jobId: dto.jobId,
      currency: dto.currency || 'VND',
      amount: dto.amount,
      description: dto.description,
      paymentMethod: dto.paymentMethod || null,
      status: CobStatus.OPEN,
      createdBy: userId,
      updatedBy: userId,
    });

    const saved = await this.cobRepo.save(entry);
    await this.auditSvc.log({
      entityName: 'CobEntry', entityId: saved.id, action: 'CREATE_COLLECT', userId,
      newValues: { partnerId: dto.partnerId, vendorId: dto.vendorId, amount: dto.amount },
    });
    return saved;
  }

  async settleCollect(id: number, userId: number) {
    return this.settleCob(id, userId); // Same logic
  }

  async voidCob(id: number, reason: string | undefined, userId: number) {
    const result = await this.dataSource.transaction(async (em) => {
      const entry = await em.findOne(CobEntry, { where: { id } });
      if (!entry) throw new NotFoundException('COB entry not found');
      if (entry.type !== CobType.CHARGE_ON_BEHALF) {
        throw new BadRequestException('Only charge-on-behalf entries can be voided from this endpoint');
      }
      if (entry.status === CobStatus.VOIDED) {
        throw new BadRequestException('Entry is already voided');
      }
      if (entry.status === CobStatus.SETTLED) {
        throw new BadRequestException('Settled charge-on-behalf cannot be voided');
      }
      if (entry.billedDebitNoteId) {
        throw new BadRequestException('This charge-on-behalf is included in a Debit Note and must be voided from the Debit Note');
      }

      const relatedEntries = entry.relatedCobEntryId
        ? await em.find(CobEntry, {
            where: [{ id: entry.relatedCobEntryId }, { relatedCobEntryId: entry.id }],
          })
        : await em.find(CobEntry, { where: { relatedCobEntryId: entry.id } });

      const activeRelatedEntries = relatedEntries.filter((related) => related.status !== CobStatus.VOIDED);
      const settledRelated = activeRelatedEntries.find((related) => related.status === CobStatus.SETTLED);
      if (settledRelated) {
        throw new BadRequestException('Paired collect-on-behalf is already settled and cannot be voided automatically');
      }

      const now = new Date();
      entry.status = CobStatus.VOIDED;
      entry.voidedAt = now;
      entry.voidedBy = userId;
      entry.updatedBy = userId;
      await em.save(CobEntry, entry);

      for (const related of activeRelatedEntries) {
        related.status = CobStatus.VOIDED;
        related.voidedAt = now;
        related.voidedBy = userId;
        related.updatedBy = userId;
      }
      if (activeRelatedEntries.length) {
        await em.save(CobEntry, activeRelatedEntries);
      }

      if (entry.receivableEntryId) {
        const receivable = await em.findOne(RevenueEntry, { where: { id: entry.receivableEntryId } });
        if (receivable?.status === AccountingStatus.POSTED) {
          await em.save(RevenueEntry, {
            ...receivable,
            status: AccountingStatus.VOIDED,
            voidedAt: now,
            voidedBy: userId,
            updatedBy: userId,
          });
        }
      }

      return { entry, relatedEntries: activeRelatedEntries };
    });

    await this.customerDebtService.refreshPartnerActualDebt(result.entry.partnerId);
    await this.auditSvc.log({
      entityName: 'CobEntry',
      entityId: id,
      action: 'VOID_COB',
      userId,
      newValues: {
        relatedCobEntryIds: result.relatedEntries.map((item) => item.id),
        receivableEntryId: result.entry.receivableEntryId,
        reason,
      },
    });
    return result.entry;
  }

  async voidCollect(id: number, reason: string | undefined, userId: number) {
    const result = await this.dataSource.transaction(async (em) => {
      const entry = await em.findOne(CobEntry, { where: { id } });
      if (!entry) throw new NotFoundException('COB entry not found');
      if (entry.type !== CobType.COLLECT_ON_BEHALF) {
        throw new BadRequestException('Only collect-on-behalf entries can be voided from this endpoint');
      }
      if (entry.status === CobStatus.VOIDED) {
        throw new BadRequestException('Entry is already voided');
      }
      if (entry.status === CobStatus.SETTLED) {
        throw new BadRequestException('Settled collect-on-behalf cannot be voided');
      }
      if (entry.relatedCobEntryId) {
        throw new BadRequestException('This collect-on-behalf is paired with a charge-on-behalf. Please void the charge-on-behalf instead');
      }

      const now = new Date();
      entry.status = CobStatus.VOIDED;
      entry.voidedAt = now;
      entry.voidedBy = userId;
      entry.updatedBy = userId;
      return em.save(CobEntry, entry);
    });

    await this.auditSvc.log({
      entityName: 'CobEntry',
      entityId: id,
      action: 'VOID_COLLECT',
      userId,
      newValues: { reason },
    });
    return result;
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────

  private async createAutoReceivable(cobEntry: CobEntry, userId: number): Promise<RevenueEntry> {
    if (!cobEntry.jobId) {
      throw new BadRequestException('Job is required to create a COB receivable');
    }
    const receivable = this.revenueRepo.create({
      jobId: cobEntry.jobId,
      description: `Receivable from COB #${cobEntry.id}: ${cobEntry.description || ''}`,
      currency: cobEntry.currency,
      amount: cobEntry.amount,
      exchangeRate: 1,
      localAmount: cobEntry.amount,
      status: AccountingStatus.POSTED,
      paymentStatus: PaymentStatus.UNPAID,
      postedAt: new Date(),
      postedBy: userId,
      createdBy: userId,
      updatedBy: userId,
    });
    return this.revenueRepo.save(receivable);
  }

  private async createPairedCollectEntry(cobEntry: CobEntry, userId: number): Promise<CobEntry> {
    const collectEntry = this.cobRepo.create({
      type: CobType.COLLECT_ON_BEHALF,
      partnerId: cobEntry.partnerId,
      vendorId: cobEntry.vendorId,
      jobId: cobEntry.jobId,
      costEntryId: cobEntry.costEntryId,
      receivableEntryId: cobEntry.receivableEntryId,
      relatedCobEntryId: cobEntry.id,
      currency: cobEntry.currency,
      amount: cobEntry.amount,
      description: `Auto collect-on-behalf from COB #${cobEntry.id}: ${cobEntry.description || ''}`,
      status: CobStatus.OPEN,
      createdBy: userId,
      updatedBy: userId,
    });

    const saved = await this.cobRepo.save(collectEntry);
    await this.auditSvc.log({
      entityName: 'CobEntry',
      entityId: saved.id,
      action: 'CREATE_COLLECT_FROM_COB',
      userId,
      newValues: { cobEntryId: cobEntry.id, partnerId: saved.partnerId, amount: saved.amount },
    });
    return saved;
  }

  private async findOneOrFail(id: number): Promise<CobEntry> {
    const entry = await this.cobRepo.findOne({ where: { id } });
    if (!entry) throw new NotFoundException('COB entry not found');
    return entry;
  }
}
