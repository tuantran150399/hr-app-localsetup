import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DebitNote, DebitNoteStatus } from '../../models/debit-note.entity';
import { DebitNoteLine } from '../../models/debit-note-line.entity';
import { ServicePrice } from '../../models/service-price.entity';
import { CreateDebitNoteDto, UpdateDebitNoteDto, VoidDebitNoteDto, DebitNoteFilterDto } from './dto/debit-note.dto';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { paginate, getSkip } from '../../common/utils/pagination.util';

@Injectable()
export class DebitNotesService {
  constructor(
    @InjectRepository(DebitNote) private noteRepo: Repository<DebitNote>,
    @InjectRepository(DebitNoteLine) private lineRepo: Repository<DebitNoteLine>,
    @InjectRepository(ServicePrice) private priceRepo: Repository<ServicePrice>,
    private auditSvc: AuditLogsService,
  ) {}

  // ─── CRUD ────────────────────────────────────────────────────────────────

  async create(dto: CreateDebitNoteDto, userId: number) {
    const note = this.noteRepo.create({
      partnerId: dto.partnerId,
      jobId: dto.jobId,
      currency: dto.currency || 'VND',
      docDate: dto.docDate ? new Date(dto.docDate) : null,
      dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
      description: dto.description,
      amount: dto.amount || 0,
      status: DebitNoteStatus.DRAFT,
      createdBy: userId,
      updatedBy: userId,
    });

    const saved = await this.noteRepo.save(note);

    // Save line items
    if (dto.lineItems?.length) {
      let totalAmount = 0;
      const lines = dto.lineItems.map((item) => {
        const lineAmount = Number(item.amount || 0) || Number(item.quantity || 1) * Number(item.unitPrice || 0);
        totalAmount += lineAmount;
        return this.lineRepo.create({
          debitNoteId: saved.id,
          serviceType: item.serviceType,
          description: item.description,
          quantity: item.quantity || 1,
          unitPrice: item.unitPrice || 0,
          amount: lineAmount,
          currency: item.currency || dto.currency || 'VND',
          pricingId: item.pricingId,
        });
      });
      await this.lineRepo.save(lines);

      // Update total amount from line items
      saved.amount = totalAmount;
      await this.noteRepo.save(saved);
    }

    await this.auditSvc.log({
      entityName: 'DebitNote', entityId: saved.id, action: 'CREATE', userId,
      newValues: { partnerId: saved.partnerId, amount: saved.amount, lineCount: dto.lineItems?.length || 0 },
    });

    return saved;
  }

  async findAll(filter: DebitNoteFilterDto = {}) {
    const { page = 1, limit = 50, status, partnerId, jobId } = filter;
    const qb = this.noteRepo.createQueryBuilder('dn');
    if (status) qb.andWhere('dn.status = :status', { status });
    if (partnerId) qb.andWhere('dn.partnerId = :partnerId', { partnerId });
    if (jobId) qb.andWhere('dn.jobId = :jobId', { jobId });
    qb.orderBy('dn.createdAt', 'DESC').skip(getSkip(page, limit)).take(limit);
    return paginate(await qb.getManyAndCount(), page, limit);
  }

  async findOne(id: number) {
    const note = await this.noteRepo.findOne({ where: { id } });
    if (!note) throw new NotFoundException('Debit note not found');
    const lines = await this.lineRepo.find({ where: { debitNoteId: id }, order: { id: 'ASC' } });
    return { ...note, lineItems: lines };
  }

  async update(id: number, dto: UpdateDebitNoteDto, userId: number) {
    const note = await this.findOneOrFail(id);
    if (note.status !== DebitNoteStatus.DRAFT) {
      throw new BadRequestException('Only DRAFT debit notes can be edited');
    }

    Object.assign(note, {
      partnerId: dto.partnerId ?? note.partnerId,
      jobId: dto.jobId ?? note.jobId,
      currency: dto.currency ?? note.currency,
      docDate: dto.docDate ? new Date(dto.docDate) : note.docDate,
      dueDate: dto.dueDate ? new Date(dto.dueDate) : note.dueDate,
      description: dto.description ?? note.description,
      updatedBy: userId,
    });

    if (dto.lineItems) {
      await this.lineRepo.delete({ debitNoteId: id });
      let totalAmount = 0;
      const lines = dto.lineItems.map((item) => {
        const lineAmount = Number(item.amount || 0) || Number(item.quantity || 1) * Number(item.unitPrice || 0);
        totalAmount += lineAmount;
        return this.lineRepo.create({
          debitNoteId: id,
          serviceType: item.serviceType,
          description: item.description,
          quantity: item.quantity || 1,
          unitPrice: item.unitPrice || 0,
          amount: lineAmount,
          currency: item.currency || note.currency,
          pricingId: item.pricingId,
        });
      });
      await this.lineRepo.save(lines);
      note.amount = totalAmount;
    } else if (dto.amount !== undefined) {
      note.amount = dto.amount;
    }

    return this.noteRepo.save(note);
  }

  async delete(id: number, userId: number) {
    const note = await this.findOneOrFail(id);
    if (note.status !== DebitNoteStatus.DRAFT) {
      throw new BadRequestException('Only DRAFT debit notes can be deleted');
    }
    await this.lineRepo.delete({ debitNoteId: id });
    await this.noteRepo.delete(id);
    await this.auditSvc.log({ entityName: 'DebitNote', entityId: id, action: 'DELETE', userId });
    return { deleted: true };
  }

  // ─── Workflow ────────────────────────────────────────────────────────────

  async post(id: number, userId: number) {
    const note = await this.findOneOrFail(id);
    if (note.status !== DebitNoteStatus.DRAFT) {
      throw new BadRequestException('Only DRAFT debit notes can be posted');
    }
    note.status = DebitNoteStatus.POSTED;
    note.postedAt = new Date();
    note.postedBy = userId;
    note.updatedBy = userId;
    await this.auditSvc.log({ entityName: 'DebitNote', entityId: id, action: 'POST', userId });
    return this.noteRepo.save(note);
  }

  async send(id: number, userId: number) {
    const note = await this.findOneOrFail(id);
    if (note.status !== DebitNoteStatus.POSTED) {
      throw new BadRequestException('Only POSTED debit notes can be sent');
    }
    note.status = DebitNoteStatus.SENT;
    note.sentAt = new Date();
    note.sentBy = userId;
    note.updatedBy = userId;
    await this.auditSvc.log({ entityName: 'DebitNote', entityId: id, action: 'SEND', userId });
    return this.noteRepo.save(note);
  }

  async void(id: number, reason: string, userId: number) {
    const note = await this.findOneOrFail(id);
    if (note.status === DebitNoteStatus.VOIDED) {
      throw new BadRequestException('Debit note is already voided');
    }
    const oldStatus = note.status;
    note.status = DebitNoteStatus.VOIDED;
    note.voidedAt = new Date();
    note.voidedBy = userId;
    note.voidReason = reason;
    note.updatedBy = userId;
    await this.auditSvc.log({
      entityName: 'DebitNote', entityId: id, action: 'VOID', userId,
      oldValues: { status: oldStatus }, newValues: { status: 'VOIDED', reason },
    });
    return this.noteRepo.save(note);
  }

  // ─── Pricing Lookup ──────────────────────────────────────────────────────

  async lookupPricing(partnerId?: number, jobId?: number) {
    const qb = this.priceRepo.createQueryBuilder('p')
      .where('p.isActive = :active', { active: true });

    if (partnerId) {
      // Match customer-specific OR general tariffs
      qb.andWhere('(p.partnerId = :partnerId OR p.partnerId IS NULL)', { partnerId });
    }

    // Only include currently effective tariffs
    qb.andWhere('(p.effectiveFrom IS NULL OR p.effectiveFrom <= CURDATE())')
      .andWhere('(p.effectiveTo IS NULL OR p.effectiveTo >= CURDATE())');

    qb.orderBy('p.partnerId', 'DESC') // Customer-specific first, then general
      .addOrderBy('p.serviceType', 'ASC');

    const items = await qb.getMany();
    return { data: items, meta: { total: items.length, page: 1, limit: items.length, totalPages: 1 } };
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────

  private async findOneOrFail(id: number): Promise<DebitNote> {
    const note = await this.noteRepo.findOne({ where: { id } });
    if (!note) throw new NotFoundException('Debit note not found');
    return note;
  }
}
