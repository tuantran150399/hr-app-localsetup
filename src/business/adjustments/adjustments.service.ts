import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AdjustmentEntry } from '../../models/adjustment-entry.entity';
import { CreateAdjustmentDto, AdjustmentFilterDto } from './dto/adjustment.dto';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { paginate, getSkip } from '../../common/utils/pagination.util';

@Injectable()
export class AdjustmentsService {
  constructor(
    @InjectRepository(AdjustmentEntry) private repo: Repository<AdjustmentEntry>,
    private auditSvc: AuditLogsService,
  ) {}

  async create(dto: CreateAdjustmentDto, userId: number) {
    const exchangeRate = dto.exchangeRate || 1;
    const localAmount = dto.localAmount ?? dto.amount * exchangeRate;

    const entry = this.repo.create({
      jobId: dto.jobId,
      type: dto.type,
      originalEntryId: dto.originalEntryId,
      originalEntryType: dto.originalEntryType,
      description: dto.description,
      currency: dto.currency,
      amount: dto.amount,
      exchangeRate,
      localAmount,
      docDate: dto.docDate ? new Date(dto.docDate) : new Date(),
      notes: dto.notes,
      createdBy: userId,
      updatedBy: userId,
    });

    const saved = await this.repo.save(entry);

    await this.auditSvc.log({
      entityName: 'AdjustmentEntry', entityId: saved.id, action: 'CREATE', userId,
      newValues: { type: saved.type, amount: saved.amount, jobId: saved.jobId },
    });

    return saved;
  }

  async findAll(filter: AdjustmentFilterDto = {}) {
    const { page = 1, limit = 50, type, jobId } = filter;
    const qb = this.repo.createQueryBuilder('a');
    if (type) qb.andWhere('a.type = :type', { type });
    if (jobId) qb.andWhere('a.jobId = :jobId', { jobId });
    qb.orderBy('a.createdAt', 'DESC').skip(getSkip(page, limit)).take(limit);
    return paginate(await qb.getManyAndCount(), page, limit);
  }

  async findOne(id: number) {
    const entry = await this.repo.findOne({ where: { id } });
    if (!entry) throw new NotFoundException('Adjustment entry not found');
    return entry;
  }

  async approve(id: number, userId: number) {
    const entry = await this.findOne(id);
    entry.approvedAt = new Date();
    entry.approvedBy = userId;
    entry.updatedBy = userId;
    await this.auditSvc.log({ entityName: 'AdjustmentEntry', entityId: id, action: 'APPROVE', userId });
    return this.repo.save(entry);
  }

  async delete(id: number, userId: number) {
    const entry = await this.findOne(id);
    if (entry.approvedAt) {
      throw new NotFoundException('Cannot delete an approved adjustment');
    }
    await this.repo.delete(id);
    await this.auditSvc.log({ entityName: 'AdjustmentEntry', entityId: id, action: 'DELETE', userId });
    return { deleted: true };
  }

  /** Get adjustment summary for a job — used in reconciliation view */
  async getJobAdjustmentSummary(jobId: number) {
    const entries = await this.repo.find({ where: { jobId }, order: { createdAt: 'DESC' } });
    const totalRevAdj = entries
      .filter((e) => e.originalEntryType === 'REVENUE')
      .reduce((sum, e) => sum + Number(e.amount), 0);
    const totalCostAdj = entries
      .filter((e) => e.originalEntryType === 'COST')
      .reduce((sum, e) => sum + Number(e.amount), 0);

    return {
      entries,
      summary: {
        totalRevenueAdjustment: totalRevAdj,
        totalCostAdjustment: totalCostAdj,
        netAdjustment: totalRevAdj - totalCostAdj,
        count: entries.length,
      },
    };
  }
}
