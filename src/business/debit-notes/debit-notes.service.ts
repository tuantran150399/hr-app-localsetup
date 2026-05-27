import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { DebitNote, DebitNoteStatus } from '../../models/debit-note.entity';
import { DebitNoteLine } from '../../models/debit-note-line.entity';
import { ServicePrice } from '../../models/service-price.entity';
import { Job } from '../../models/job.entity';
import { AccountingStatus, PaymentStatus, RevenueEntry } from '../../models/revenue-entry.entity';
import { CreateDebitNoteDto, UpdateDebitNoteDto, VoidDebitNoteDto, DebitNoteFilterDto, RecordDebitNotePaymentDto } from './dto/debit-note.dto';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { paginate, getSkip } from '../../common/utils/pagination.util';
import { assertBranchAccess, AuthenticatedUser, getScopedBranchId } from '../../common/auth/branch-scope.util';

@Injectable()
export class DebitNotesService {
  constructor(
    @InjectRepository(DebitNote) private noteRepo: Repository<DebitNote>,
    @InjectRepository(DebitNoteLine) private lineRepo: Repository<DebitNoteLine>,
    @InjectRepository(ServicePrice) private priceRepo: Repository<ServicePrice>,
    @InjectRepository(Job) private jobRepo: Repository<Job>,
    @InjectRepository(RevenueEntry) private revenueRepo: Repository<RevenueEntry>,
    private dataSource: DataSource,
    private auditSvc: AuditLogsService,
  ) {}

  private enforceBranchAccess(user: AuthenticatedUser | undefined, branchId?: number | null) {
    try {
      assertBranchAccess(user, branchId);
    } catch {
      throw new ForbiddenException('You cannot access debit notes from another branch');
    }
  }

  // ─── CRUD ────────────────────────────────────────────────────────────────

  async create(dto: CreateDebitNoteDto, actor: AuthenticatedUser) {
    const saved = await this.dataSource.transaction(async (em) => {
      const job = await this.assertJob(dto.jobId);
      this.enforceBranchAccess(actor, job.branchId);
      const totalAmount = this.calculateLineTotal(dto.lineItems, dto.amount);
      const note = await em.save(DebitNote, em.create(DebitNote, {
        partnerId: job.partnerId,
        jobId: job.id,
        currency: dto.currency || 'VND',
        docDate: dto.docDate ? new Date(dto.docDate) : null,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
        description: dto.description,
        paymentMethod: dto.paymentMethod || null,
        paymentAccountRef: dto.paymentAccountRef || null,
        paymentStatus: PaymentStatus.UNPAID,
        paidAmount: 0,
        amount: totalAmount,
        status: DebitNoteStatus.POSTED,
        postedAt: new Date(),
        postedBy: actor.id,
        createdBy: actor.id,
        updatedBy: actor.id,
      }));

      await this.saveLineItems(em, note.id, dto.lineItems || [], note.currency);
      return this.syncReceivable(em, note, actor.id);
    });

    await this.auditSvc.log({
      entityName: 'DebitNote', entityId: saved.id, action: 'CREATE', userId: actor.id,
      newValues: { partnerId: saved.partnerId, jobId: saved.jobId, amount: saved.amount, lineCount: dto.lineItems?.length || 0, receivableEntryId: saved.receivableEntryId },
    });

    return saved;
  }

  async findAll(filter: DebitNoteFilterDto = {}, actor?: AuthenticatedUser) {
    const { page = 1, limit = 50, status, partnerId, jobId, branchId } = filter;
    const scopedBranchId = getScopedBranchId(actor, branchId);
    const qb = this.noteRepo.createQueryBuilder('dn')
      .innerJoin(Job, 'j', 'j.id = dn.jobId');
    if (scopedBranchId) qb.andWhere('j.branchId = :branchId', { branchId: scopedBranchId });
    if (status) qb.andWhere('dn.status = :status', { status });
    if (partnerId) qb.andWhere('dn.partnerId = :partnerId', { partnerId });
    if (jobId) qb.andWhere('dn.jobId = :jobId', { jobId });
    qb.orderBy('dn.createdAt', 'DESC').skip(getSkip(page, limit)).take(limit);
    return paginate(await qb.getManyAndCount(), page, limit);
  }

  async findOne(id: number, actor?: AuthenticatedUser) {
    const note = await this.noteRepo.findOne({ where: { id } });
    if (!note) throw new NotFoundException('Debit note not found');
    await this.enforceNoteBranchAccess(note, actor);
    const lines = await this.lineRepo.find({ where: { debitNoteId: id }, order: { id: 'ASC' } });
    return { ...note, lineItems: lines };
  }

  async update(id: number, dto: UpdateDebitNoteDto, actor: AuthenticatedUser) {
    const note = await this.findOneOrFail(id);
    await this.enforceNoteBranchAccess(note, actor);
    if (![DebitNoteStatus.DRAFT, DebitNoteStatus.POSTED].includes(note.status) || note.paymentStatus !== PaymentStatus.UNPAID) {
      throw new BadRequestException('Only unpaid draft/posted debit notes can be edited');
    }

    return this.dataSource.transaction(async (em) => {
      const job = dto.jobId ? await this.assertJob(dto.jobId) : await this.assertJob(note.jobId);
      this.enforceBranchAccess(actor, job.branchId);
      Object.assign(note, {
        partnerId: job.partnerId,
        jobId: job.id,
        currency: dto.currency ?? note.currency,
        docDate: dto.docDate ? new Date(dto.docDate) : note.docDate,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : note.dueDate,
        description: dto.description ?? note.description,
        paymentMethod: dto.paymentMethod ?? note.paymentMethod,
        paymentAccountRef: dto.paymentAccountRef ?? note.paymentAccountRef,
        amount: dto.lineItems ? this.calculateLineTotal(dto.lineItems, dto.amount) : dto.amount ?? note.amount,
        updatedBy: actor.id,
      });

      const saved = await em.save(DebitNote, note);
      if (dto.lineItems) {
        await em.delete(DebitNoteLine, { debitNoteId: id });
        await this.saveLineItems(em, id, dto.lineItems, saved.currency);
      }
      return this.syncReceivable(em, saved, actor.id);
    });
  }

  async delete(id: number, actor: AuthenticatedUser) {
    const note = await this.findOneOrFail(id);
    await this.enforceNoteBranchAccess(note, actor);
    if (note.status !== DebitNoteStatus.DRAFT) {
      throw new BadRequestException('Only DRAFT debit notes can be deleted');
    }
    await this.lineRepo.delete({ debitNoteId: id });
    await this.noteRepo.delete(id);
    await this.auditSvc.log({ entityName: 'DebitNote', entityId: id, action: 'DELETE', userId: actor.id });
    return { deleted: true };
  }

  // ─── Workflow ────────────────────────────────────────────────────────────

  async post(id: number, actor: AuthenticatedUser) {
    const note = await this.findOneOrFail(id);
    await this.enforceNoteBranchAccess(note, actor);
    if (note.status !== DebitNoteStatus.DRAFT) {
      throw new BadRequestException('Only DRAFT debit notes can be posted');
    }
    note.status = DebitNoteStatus.POSTED;
    note.postedAt = new Date();
    note.postedBy = actor.id;
    note.updatedBy = actor.id;
    const saved = await this.noteRepo.save(note);
    await this.dataSource.transaction((em) => this.syncReceivable(em, saved, actor.id));
    await this.auditSvc.log({ entityName: 'DebitNote', entityId: id, action: 'POST', userId: actor.id });
    return this.findOne(id, actor);
  }

  async send(id: number, actor: AuthenticatedUser) {
    const note = await this.findOneOrFail(id);
    await this.enforceNoteBranchAccess(note, actor);
    if (note.status !== DebitNoteStatus.POSTED) {
      throw new BadRequestException('Only POSTED debit notes can be sent');
    }
    note.status = DebitNoteStatus.SENT;
    note.sentAt = new Date();
    note.sentBy = actor.id;
    note.updatedBy = actor.id;
    await this.auditSvc.log({ entityName: 'DebitNote', entityId: id, action: 'SEND', userId: actor.id });
    return this.noteRepo.save(note);
  }

  async void(id: number, reason: string, actor: AuthenticatedUser) {
    const note = await this.findOneOrFail(id);
    await this.enforceNoteBranchAccess(note, actor);
    if (note.status === DebitNoteStatus.VOIDED) {
      throw new BadRequestException('Debit note is already voided');
    }
    const oldStatus = note.status;
    note.status = DebitNoteStatus.VOIDED;
    note.voidedAt = new Date();
    note.voidedBy = actor.id;
    note.voidReason = reason;
    note.updatedBy = actor.id;
    if (note.receivableEntryId) {
      await this.revenueRepo.update(note.receivableEntryId, {
        status: AccountingStatus.VOIDED,
        voidedAt: new Date(),
        voidedBy: actor.id,
        updatedBy: actor.id,
      });
    }
    await this.auditSvc.log({
      entityName: 'DebitNote', entityId: id, action: 'VOID', userId: actor.id,
      oldValues: { status: oldStatus }, newValues: { status: 'VOIDED', reason },
    });
    return this.noteRepo.save(note);
  }

  async recordPayment(id: number, dto: RecordDebitNotePaymentDto, actor: AuthenticatedUser) {
    const saved = await this.dataSource.transaction(async (em) => {
      const note = await em.findOne(DebitNote, { where: { id } });
      if (!note) throw new NotFoundException('Debit note not found');
      await this.enforceNoteBranchAccess(note, actor);
      if (!note.receivableEntryId) {
        await this.syncReceivable(em, note, actor.id);
      }
      const receivableId = note.receivableEntryId;
      const paidAmount = Number(note.paidAmount || 0) + Number(dto.amount || 0);
      const paymentStatus = paidAmount >= Number(note.amount || 0) ? PaymentStatus.PAID : PaymentStatus.PARTIAL;
      const paidAt = dto.paymentDate ? new Date(dto.paymentDate) : new Date();

      const updated = await em.save(DebitNote, {
        ...note,
        paymentStatus,
        paymentMethod: dto.paymentMethod,
        paymentAccountRef: dto.paymentAccountRef || null,
        paidAmount,
        paidAt,
        paidBy: actor.id,
        updatedBy: actor.id,
      });

      if (receivableId) {
        await em.update(RevenueEntry, receivableId, {
          paymentStatus,
          paymentMethod: dto.paymentMethod,
          paymentAccountRef: dto.paymentAccountRef || null,
          updatedBy: actor.id,
        });
      }
      return updated;
    });

    await this.auditSvc.log({
      entityName: 'DebitNote',
      entityId: id,
      action: 'RECORD_PAYMENT',
      userId: actor.id,
      newValues: { amount: dto.amount, paymentMethod: dto.paymentMethod, paymentStatus: saved.paymentStatus },
    });
    return this.findOne(id, actor);
  }

  // ─── Pricing Lookup ──────────────────────────────────────────────────────

  async lookupPricing(partnerId?: number, jobId?: number, actor?: AuthenticatedUser) {
    let selectedJob: Job | null = null;
    if (jobId) {
      selectedJob = await this.assertJob(jobId);
      this.enforceBranchAccess(actor, selectedJob.branchId);
      partnerId = selectedJob.partnerId || partnerId;
    }

    const origin = this.normalizeText(selectedJob?.origin || selectedJob?.pol);
    const destination = this.normalizeText(selectedJob?.destination || selectedJob?.pod);
    const items = partnerId ? await this.findPrioritizedCustomerPrices(partnerId, origin, destination) : [];
    return { data: items, meta: { total: items.length, page: 1, limit: items.length, totalPages: 1 } };
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────

  private async findOneOrFail(id: number): Promise<DebitNote> {
    const note = await this.noteRepo.findOne({ where: { id } });
    if (!note) throw new NotFoundException('Debit note not found');
    return note;
  }

  private async enforceNoteBranchAccess(note: DebitNote, actor?: AuthenticatedUser) {
    if (!note.jobId) return;
    const job = await this.jobRepo.findOne({ where: { id: note.jobId } });
    if (!job || job.archivedAt) throw new BadRequestException(`Job #${note.jobId} not found`);
    this.enforceBranchAccess(actor, job.branchId);
  }

  private async assertJob(jobId?: number): Promise<Job> {
    if (!jobId) throw new BadRequestException('Job is required to create a Debit Note');
    const job = await this.jobRepo.findOne({ where: { id: jobId } });
    if (!job || job.archivedAt) throw new BadRequestException(`Job #${jobId} not found`);
    if (!job.partnerId) throw new BadRequestException(`Job #${jobId} does not have a customer`);
    return job;
  }

  private calculateLineTotal(lineItems: CreateDebitNoteDto['lineItems'], fallbackAmount?: number) {
    if (!lineItems?.length) return Number(fallbackAmount || 0);
    return lineItems.reduce((sum, item) => {
      const lineAmount = Number(item.amount || 0) || Number(item.quantity || 1) * Number(item.unitPrice || 0);
      return sum + lineAmount;
    }, 0);
  }

  private async saveLineItems(em: EntityManager, debitNoteId: number, lineItems: CreateDebitNoteDto['lineItems'], currency: string) {
    if (!lineItems?.length) return;
    const lines = lineItems.map((item) => {
      const lineAmount = Number(item.amount || 0) || Number(item.quantity || 1) * Number(item.unitPrice || 0);
      return em.create(DebitNoteLine, {
        debitNoteId,
        serviceType: item.serviceType,
        description: item.description,
        quantity: item.quantity || 1,
        unitPrice: item.unitPrice || 0,
        amount: lineAmount,
        currency: item.currency || currency || 'VND',
        pricingId: item.pricingId,
      });
    });
    await em.save(DebitNoteLine, lines);
  }

  private async syncReceivable(em: EntityManager, note: DebitNote, userId: number) {
    const receivablePayload = {
      jobId: note.jobId,
      description: `Debit Note DN-${note.id}: ${note.description || ''}`,
      currency: note.currency || 'VND',
      amount: note.amount,
      exchangeRate: 1,
      localAmount: note.amount,
      status: AccountingStatus.POSTED,
      paymentStatus: note.paymentStatus || PaymentStatus.UNPAID,
      paymentMethod: note.paymentMethod || null,
      paymentAccountRef: note.paymentAccountRef || null,
      refNumber: `DN-${note.id}`,
      invoiceNumber: `DN-${note.id}`,
      docDate: note.docDate,
      dueDate: note.dueDate,
      postedAt: note.postedAt || new Date(),
      postedBy: note.postedBy || userId,
      updatedBy: userId,
    };

    let receivable: RevenueEntry;
    if (note.receivableEntryId) {
      await em.update(RevenueEntry, note.receivableEntryId, receivablePayload);
      receivable = await em.findOneOrFail(RevenueEntry, { where: { id: note.receivableEntryId } });
    } else {
      receivable = await em.save(RevenueEntry, em.create(RevenueEntry, { ...receivablePayload, createdBy: userId }));
      note.receivableEntryId = receivable.id;
      note.updatedBy = userId;
      await em.save(DebitNote, note);
    }
    return { ...note, receivableEntryId: receivable.id };
  }

  private normalizeText(value?: string): string {
    return String(value ?? '').trim().toLowerCase();
  }

  private async findPrioritizedCustomerPrices(partnerId: number, origin: string, destination: string): Promise<ServicePrice[]> {
    const baseQb = () => this.priceRepo.createQueryBuilder('p')
      .where('p.isActive = :active', { active: true })
      .andWhere('p.partnerId = :partnerId', { partnerId })
      .andWhere('(p.effectiveFrom IS NULL OR p.effectiveFrom <= CURDATE())')
      .andWhere('(p.effectiveTo IS NULL OR p.effectiveTo >= CURDATE())')
      .orderBy('p.serviceType', 'ASC')
      .addOrderBy('p.effectiveFrom', 'DESC');

    if (origin && destination) {
      const routePrices = await baseQb()
        .andWhere('LOWER(TRIM(p.routeFrom)) = :origin', { origin })
        .andWhere('LOWER(TRIM(p.routeTo)) = :destination', { destination })
        .getMany();
      if (routePrices.length) return routePrices;
    }

    return baseQb()
      .andWhere('(p.routeFrom IS NULL OR TRIM(p.routeFrom) = \'\')')
      .andWhere('(p.routeTo IS NULL OR TRIM(p.routeTo) = \'\')')
      .getMany();
  }
}
