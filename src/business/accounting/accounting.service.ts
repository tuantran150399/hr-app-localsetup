import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { RevenueEntry, AccountingStatus, PaymentStatus } from '../../models/revenue-entry.entity';
import { CostEntry } from '../../models/cost-entry.entity';
import { Job, JobStatus } from '../../models/job.entity';
import { Partner, PartnerType } from '../../models/partner.entity';
import { AccountingPeriod } from '../../models/accounting-period.entity';
import { CreateEntryDto, UpdateEntryDto, EntryFilterDto, UpdatePaymentStatusDto, LockPeriodDto, RecordPaymentDto } from './dto/entry.dto';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { paginate, getSkip } from '../../common/utils/pagination.util';

@Injectable()
export class AccountingService {
  constructor(
    @InjectRepository(RevenueEntry) private revRepo: Repository<RevenueEntry>,
    @InjectRepository(CostEntry) private costRepo: Repository<CostEntry>,
    @InjectRepository(Job) private jobRepo: Repository<Job>,
    @InjectRepository(Partner) private partnerRepo: Repository<Partner>,
    @InjectRepository(AccountingPeriod) private periodRepo: Repository<AccountingPeriod>,
    private dataSource: DataSource,
    private auditLogs: AuditLogsService,
  ) {}

  private async assertJobExists(jobId: number): Promise<Job> {
    const job = await this.jobRepo.findOne({ where: { id: jobId } });
    if (!job || job.archivedAt) throw new NotFoundException(`Job #${jobId} not found`);
    return job;
  }

  private async assertVendorExists(vendorId?: number): Promise<void> {
    if (!vendorId) return;
    const vendor = await this.partnerRepo.findOne({ where: { id: vendorId, isActive: true } });
    if (!vendor || ![PartnerType.VENDOR, PartnerType.BOTH].includes(vendor.partnerType)) {
      throw new BadRequestException(`Vendor #${vendorId} not found`);
    }
  }

  private assertJobPostable(job: Job): void {
    if (job.status === JobStatus.CANCELLED) {
      throw new BadRequestException('Cannot post entries for a CANCELLED job');
    }
  }

  private entryDate(docDate?: string | Date | null): Date {
    if (!docDate) return new Date();
    return docDate instanceof Date ? docDate : new Date(docDate);
  }

  private async assertPeriodNotLocked(date: Date): Promise<void> {
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const period = await this.periodRepo.findOne({ where: { year, month } });
    if (period?.isLocked) {
      throw new ForbiddenException(
        `Accounting period ${year}/${String(month).padStart(2, '0')} is locked.`,
      );
    }
  }

  async createRevenue(dto: CreateEntryDto, actorId: number) {
    const entry = await this.dataSource.transaction(async (em) => {
      await this.assertJobExists(dto.jobId);
      await this.assertPeriodNotLocked(this.entryDate(dto.docDate));
      return em.save(RevenueEntry, em.create(RevenueEntry, { ...dto, createdBy: actorId, updatedBy: actorId }));
    });
    await this.auditLogs.log({
      entityName: 'RevenueEntry',
      entityId: entry.id,
      action: 'CREATE',
      userId: actorId,
      newValues: { jobId: entry.jobId, localAmount: entry.localAmount, status: entry.status },
    });
    return entry;
  }

  async findRevenue(filter: EntryFilterDto) {
    const { page = 1, limit = 20, jobId, status, paymentStatus, dateFrom, dateTo, sortBy = 'createdAt', sortOrder = 'DESC' } = filter;
    const qb = this.revRepo.createQueryBuilder('r');
    if (jobId) qb.andWhere('r.jobId = :jobId', { jobId });
    if (status) qb.andWhere('r.status = :status', { status });
    if (paymentStatus) qb.andWhere('r.paymentStatus = :paymentStatus', { paymentStatus });
    if (dateFrom) qb.andWhere('r.createdAt >= :dateFrom', { dateFrom });
    if (dateTo) qb.andWhere('r.createdAt <= :dateTo', { dateTo });
    const allowed = ['createdAt', 'docDate', 'dueDate', 'localAmount'];
    const col = allowed.includes(sortBy) ? sortBy : 'createdAt';
    qb.orderBy(`r.${col}`, sortOrder).skip(getSkip(page, limit)).take(limit);
    return paginate(await qb.getManyAndCount(), page, limit);
  }

  async findRevenueOne(id: number) {
    const entry = await this.revRepo.findOne({ where: { id } });
    if (!entry) throw new NotFoundException('Revenue entry not found');
    return entry;
  }

  findRevenueByJob(jobId: number) {
    return this.revRepo.find({ where: { jobId }, order: { createdAt: 'ASC' } });
  }

  async updateRevenue(id: number, dto: UpdateEntryDto, actorId: number) {
    const updated = await this.dataSource.transaction(async (em) => {
      const entry = await em.findOne(RevenueEntry, { where: { id } });
      if (!entry) throw new NotFoundException('Revenue entry not found');
      if (entry.status === AccountingStatus.POSTED)
        throw new BadRequestException('Cannot modify a POSTED entry - use void/reversal instead');
      if (entry.status === AccountingStatus.VOIDED)
        throw new BadRequestException('Cannot modify a VOIDED entry');
      await this.assertPeriodNotLocked(this.entryDate(dto.docDate ?? entry.docDate));
      return em.save(RevenueEntry, { ...entry, ...dto, updatedBy: actorId });
    });
    await this.auditLogs.log({
      entityName: 'RevenueEntry',
      entityId: id,
      action: 'UPDATE',
      userId: actorId,
      newValues: { jobId: updated.jobId, localAmount: updated.localAmount, status: updated.status },
    });
    return updated;
  }

  async deleteRevenue(id: number, actorId?: number) {
    const entry = await this.dataSource.transaction(async (em) => {
      const existing = await em.findOne(RevenueEntry, { where: { id } });
      if (!existing) throw new NotFoundException('Revenue entry not found');
      if (existing.status !== AccountingStatus.DRAFT)
        throw new BadRequestException('Only DRAFT entries can be deleted');
      await this.assertPeriodNotLocked(this.entryDate(existing.docDate));
      await em.remove(RevenueEntry, existing);
      return existing;
    });
    await this.auditLogs.log({
      entityName: 'RevenueEntry',
      entityId: id,
      action: 'DELETE',
      userId: actorId,
      oldValues: { jobId: entry.jobId, localAmount: entry.localAmount, status: entry.status },
    });
    return { message: 'Revenue entry deleted' };
  }

  async updateRevenuePaymentStatus(id: number, dto: UpdatePaymentStatusDto, actorId: number) {
    const entry = await this.revRepo.findOne({ where: { id } });
    if (!entry) throw new NotFoundException('Revenue entry not found');
    if (entry.status !== AccountingStatus.POSTED)
      throw new BadRequestException('Payment status can only be updated on POSTED entries');
    await this.assertPeriodNotLocked(this.entryDate(entry.docDate ?? entry.postedAt));
    const old = entry.paymentStatus;
    const updated = await this.revRepo.save({ ...entry, paymentStatus: dto.paymentStatus, updatedBy: actorId });
    await this.auditLogs.log({
      entityName: 'RevenueEntry',
      entityId: id,
      action: 'PAYMENT_STATUS_CHANGE',
      userId: actorId,
      oldValues: { paymentStatus: old },
      newValues: { paymentStatus: dto.paymentStatus },
    });
    return updated;
  }

  async postRevenue(id: number, actorId: number) {
    const posted = await this.dataSource.transaction(async (em) => {
      const entry = await em.findOne(RevenueEntry, { where: { id } });
      if (!entry) throw new NotFoundException('Revenue entry not found');
      if (entry.status === AccountingStatus.POSTED) throw new BadRequestException('Already posted');
      if (entry.status === AccountingStatus.VOIDED) throw new BadRequestException('Entry is voided');
      const job = await em.findOne(Job, { where: { id: entry.jobId } });
      if (!job || job.archivedAt) throw new NotFoundException(`Job #${entry.jobId} not found`);
      this.assertJobPostable(job);
      await this.assertPeriodNotLocked(this.entryDate(entry.docDate));
      return em.save(RevenueEntry, { ...entry, status: AccountingStatus.POSTED, postedAt: new Date(), postedBy: actorId, updatedBy: actorId });
    });
    await this.auditLogs.log({ entityName: 'RevenueEntry', entityId: id, action: 'POST_REVENUE', userId: actorId, newValues: { status: AccountingStatus.POSTED, jobId: posted.jobId } });
    return posted;
  }

  async voidRevenue(id: number, actorId: number, reason?: string) {
    const result = await this.dataSource.transaction(async (em) => {
      const original = await em.findOne(RevenueEntry, { where: { id } });
      if (!original) throw new NotFoundException('Revenue entry not found');
      if (original.status !== AccountingStatus.POSTED)
        throw new BadRequestException('Only POSTED entries can be voided');
      await this.assertPeriodNotLocked(this.entryDate(original.docDate ?? original.postedAt));
      await this.assertPeriodNotLocked(new Date());
      await em.save(RevenueEntry, { ...original, status: AccountingStatus.VOIDED, voidedAt: new Date(), voidedBy: actorId, updatedBy: actorId });
      const reversal = em.create(RevenueEntry, {
        jobId: original.jobId,
        description: `[VOID] ${original.description}${reason ? ' - ' + reason : ''}`,
        currency: original.currency,
        amount: -Number(original.amount),
        exchangeRate: original.exchangeRate,
        localAmount: -Number(original.localAmount),
        status: AccountingStatus.POSTED,
        paymentStatus: PaymentStatus.PAID,
        reversalOf: original.id,
        postedAt: new Date(),
        postedBy: actorId,
        createdBy: actorId,
        updatedBy: actorId,
      });
      return em.save(RevenueEntry, reversal);
    });
    await this.auditLogs.log({ entityName: 'RevenueEntry', entityId: id, action: 'VOID_REVENUE', userId: actorId, newValues: { reversalEntryId: result.id, reason } });
    return result;
  }

  async createCost(dto: CreateEntryDto, actorId: number) {
    const entry = await this.dataSource.transaction(async (em) => {
      await this.assertJobExists(dto.jobId);
      await this.assertVendorExists(dto.vendorId);
      await this.assertPeriodNotLocked(this.entryDate(dto.docDate));
      return em.save(CostEntry, em.create(CostEntry, { ...dto, createdBy: actorId, updatedBy: actorId }));
    });
    await this.auditLogs.log({
      entityName: 'CostEntry',
      entityId: entry.id,
      action: 'CREATE',
      userId: actorId,
      newValues: { jobId: entry.jobId, vendorId: entry.vendorId, localAmount: entry.localAmount, status: entry.status },
    });
    return entry;
  }

  async findCost(filter: EntryFilterDto) {
    const { page = 1, limit = 20, jobId, vendorId, status, paymentStatus, dateFrom, dateTo, sortBy = 'createdAt', sortOrder = 'DESC' } = filter;
    const qb = this.costRepo.createQueryBuilder('c');
    if (jobId) qb.andWhere('c.jobId = :jobId', { jobId });
    if (vendorId) qb.andWhere('c.vendorId = :vendorId', { vendorId });
    if (status) qb.andWhere('c.status = :status', { status });
    if (paymentStatus) qb.andWhere('c.paymentStatus = :paymentStatus', { paymentStatus });
    if (dateFrom) qb.andWhere('c.createdAt >= :dateFrom', { dateFrom });
    if (dateTo) qb.andWhere('c.createdAt <= :dateTo', { dateTo });
    const allowed = ['createdAt', 'docDate', 'dueDate', 'localAmount'];
    const col = allowed.includes(sortBy) ? sortBy : 'createdAt';
    qb.orderBy(`c.${col}`, sortOrder).skip(getSkip(page, limit)).take(limit);
    return paginate(await qb.getManyAndCount(), page, limit);
  }

  async findCostOne(id: number) {
    const entry = await this.costRepo.findOne({ where: { id } });
    if (!entry) throw new NotFoundException('Cost entry not found');
    return entry;
  }

  findCostByJob(jobId: number) {
    return this.costRepo.find({ where: { jobId }, order: { createdAt: 'ASC' } });
  }

  async updateCost(id: number, dto: UpdateEntryDto, actorId: number) {
    const updated = await this.dataSource.transaction(async (em) => {
      const entry = await em.findOne(CostEntry, { where: { id } });
      if (!entry) throw new NotFoundException('Cost entry not found');
      if (entry.status === AccountingStatus.POSTED)
        throw new BadRequestException('Cannot modify a POSTED entry - use void/reversal instead');
      if (entry.status === AccountingStatus.VOIDED)
        throw new BadRequestException('Cannot modify a VOIDED entry');
      await this.assertVendorExists(dto.vendorId ?? entry.vendorId);
      await this.assertPeriodNotLocked(this.entryDate(dto.docDate ?? entry.docDate));
      return em.save(CostEntry, { ...entry, ...dto, updatedBy: actorId });
    });
    await this.auditLogs.log({
      entityName: 'CostEntry',
      entityId: id,
      action: 'UPDATE',
      userId: actorId,
      newValues: { jobId: updated.jobId, vendorId: updated.vendorId, localAmount: updated.localAmount, status: updated.status },
    });
    return updated;
  }

  async deleteCost(id: number, actorId?: number) {
    const entry = await this.dataSource.transaction(async (em) => {
      const existing = await em.findOne(CostEntry, { where: { id } });
      if (!existing) throw new NotFoundException('Cost entry not found');
      if (existing.status !== AccountingStatus.DRAFT)
        throw new BadRequestException('Only DRAFT entries can be deleted');
      await this.assertPeriodNotLocked(this.entryDate(existing.docDate));
      await em.remove(CostEntry, existing);
      return existing;
    });
    await this.auditLogs.log({
      entityName: 'CostEntry',
      entityId: id,
      action: 'DELETE',
      userId: actorId,
      oldValues: { jobId: entry.jobId, vendorId: entry.vendorId, localAmount: entry.localAmount, status: entry.status },
    });
    return { message: 'Cost entry deleted' };
  }

  async updateCostPaymentStatus(id: number, dto: UpdatePaymentStatusDto, actorId: number) {
    const entry = await this.costRepo.findOne({ where: { id } });
    if (!entry) throw new NotFoundException('Cost entry not found');
    if (entry.status !== AccountingStatus.POSTED)
      throw new BadRequestException('Payment status can only be updated on POSTED entries');
    await this.assertPeriodNotLocked(this.entryDate(entry.docDate ?? entry.postedAt));
    const old = entry.paymentStatus;
    const updated = await this.costRepo.save({ ...entry, paymentStatus: dto.paymentStatus, updatedBy: actorId });
    await this.auditLogs.log({
      entityName: 'CostEntry',
      entityId: id,
      action: 'PAYMENT_STATUS_CHANGE',
      userId: actorId,
      oldValues: { paymentStatus: old },
      newValues: { paymentStatus: dto.paymentStatus },
    });
    return updated;
  }

  async postCost(id: number, actorId: number) {
    const posted = await this.dataSource.transaction(async (em) => {
      const entry = await em.findOne(CostEntry, { where: { id } });
      if (!entry) throw new NotFoundException('Cost entry not found');
      if (entry.status === AccountingStatus.POSTED) throw new BadRequestException('Already posted');
      if (entry.status === AccountingStatus.VOIDED) throw new BadRequestException('Entry is voided');
      const job = await em.findOne(Job, { where: { id: entry.jobId } });
      if (!job || job.archivedAt) throw new NotFoundException(`Job #${entry.jobId} not found`);
      this.assertJobPostable(job);
      await this.assertVendorExists(entry.vendorId);
      await this.assertPeriodNotLocked(this.entryDate(entry.docDate));
      return em.save(CostEntry, { ...entry, status: AccountingStatus.POSTED, postedAt: new Date(), postedBy: actorId, updatedBy: actorId });
    });
    await this.auditLogs.log({ entityName: 'CostEntry', entityId: id, action: 'POST_COST', userId: actorId, newValues: { status: AccountingStatus.POSTED, jobId: posted.jobId } });
    return posted;
  }

  async voidCost(id: number, actorId: number, reason?: string) {
    const result = await this.dataSource.transaction(async (em) => {
      const original = await em.findOne(CostEntry, { where: { id } });
      if (!original) throw new NotFoundException('Cost entry not found');
      if (original.status !== AccountingStatus.POSTED)
        throw new BadRequestException('Only POSTED entries can be voided');
      await this.assertPeriodNotLocked(this.entryDate(original.docDate ?? original.postedAt));
      await this.assertPeriodNotLocked(new Date());
      await em.save(CostEntry, { ...original, status: AccountingStatus.VOIDED, voidedAt: new Date(), voidedBy: actorId, updatedBy: actorId });
      const reversal = em.create(CostEntry, {
        jobId: original.jobId,
        vendorId: original.vendorId,
        description: `[VOID] ${original.description}${reason ? ' - ' + reason : ''}`,
        currency: original.currency,
        amount: -Number(original.amount),
        exchangeRate: original.exchangeRate,
        localAmount: -Number(original.localAmount),
        status: AccountingStatus.POSTED,
        paymentStatus: PaymentStatus.PAID,
        reversalOf: original.id,
        postedAt: new Date(),
        postedBy: actorId,
        createdBy: actorId,
        updatedBy: actorId,
      });
      return em.save(CostEntry, reversal);
    });
    await this.auditLogs.log({ entityName: 'CostEntry', entityId: id, action: 'VOID_COST', userId: actorId, newValues: { reversalEntryId: result.id, reason } });
    return result;
  }

  async postAllForJob(jobId: number, actorId: number) {
    const result = await this.dataSource.transaction(async (em) => {
      const job = await em.findOne(Job, { where: { id: jobId } });
      if (!job || job.archivedAt) throw new NotFoundException(`Job #${jobId} not found`);
      this.assertJobPostable(job);
      const [draftRev, draftCost] = await Promise.all([
        em.find(RevenueEntry, { where: { jobId, status: AccountingStatus.DRAFT } }),
        em.find(CostEntry, { where: { jobId, status: AccountingStatus.DRAFT } }),
      ]);
      if (draftRev.length === 0 && draftCost.length === 0)
        throw new BadRequestException('No DRAFT entries found for this job');

      for (const entry of [...draftRev, ...draftCost]) {
        await this.assertPeriodNotLocked(this.entryDate(entry.docDate));
      }
      for (const cost of draftCost) {
        await this.assertVendorExists(cost.vendorId);
      }

      const now = new Date();
      const base = { status: AccountingStatus.POSTED, postedAt: now, postedBy: actorId, updatedBy: actorId };
      await Promise.all([
        em.save(RevenueEntry, draftRev.map((e) => ({ ...e, ...base }))),
        em.save(CostEntry, draftCost.map((e) => ({ ...e, ...base }))),
      ]);
      return { jobId, postedRevenue: draftRev.length, postedCost: draftCost.length };
    });
    await this.auditLogs.log({ entityName: 'Job', entityId: jobId, action: 'POST_ALL', userId: actorId, newValues: result });
    return { ...result, message: `Posted ${result.postedRevenue} revenue and ${result.postedCost} cost entries` };
  }

  async getProfitSummary(jobId: number) {
    await this.assertJobExists(jobId);
    const [revEntries, costEntries] = await Promise.all([
      this.revRepo.find({ where: { jobId, status: AccountingStatus.POSTED } }),
      this.costRepo.find({ where: { jobId, status: AccountingStatus.POSTED } }),
    ]);
    const totalRevenue = revEntries.reduce((sum, e) => sum + Number(e.localAmount), 0);
    const totalCost = costEntries.reduce((sum, e) => sum + Number(e.localAmount), 0);
    return { jobId, totalRevenue, totalCost, profit: totalRevenue - totalCost, revenueEntries: revEntries.length, costEntries: costEntries.length };
  }

  async recordRevenueReceipt(dto: RecordPaymentDto, actorId: number) {
    const updated = await this.dataSource.transaction(async (em) => {
      const entry = await em.findOne(RevenueEntry, { where: { id: dto.entryId } });
      if (!entry) throw new NotFoundException('Revenue entry not found');
      if (entry.status !== AccountingStatus.POSTED) {
        throw new BadRequestException('Receipts can only be recorded for POSTED revenue entries');
      }
      await this.assertPeriodNotLocked(this.entryDate(dto.paymentDate ?? entry.docDate ?? entry.postedAt));
      const paymentStatus = Number(dto.amount) >= Number(entry.localAmount) ? PaymentStatus.PAID : PaymentStatus.PARTIAL;
      return em.save(RevenueEntry, { ...entry, paymentStatus, updatedBy: actorId });
    });
    await this.auditLogs.log({
      entityName: 'RevenueEntry',
      entityId: dto.entryId,
      action: 'RECORD_RECEIPT',
      userId: actorId,
      newValues: {
        amount: dto.amount,
        paymentDate: dto.paymentDate,
        method: dto.method,
        accountRef: dto.accountRef,
        paymentStatus: updated.paymentStatus,
      },
    });
    return updated;
  }

  async recordVendorPayment(dto: RecordPaymentDto, actorId: number) {
    const updated = await this.dataSource.transaction(async (em) => {
      const entry = await em.findOne(CostEntry, { where: { id: dto.entryId } });
      if (!entry) throw new NotFoundException('Cost entry not found');
      if (entry.status !== AccountingStatus.POSTED) {
        throw new BadRequestException('Vendor payments can only be recorded for POSTED cost entries');
      }
      await this.assertPeriodNotLocked(this.entryDate(dto.paymentDate ?? entry.docDate ?? entry.postedAt));
      const paymentStatus = Number(dto.amount) >= Number(entry.localAmount) ? PaymentStatus.PAID : PaymentStatus.PARTIAL;
      return em.save(CostEntry, { ...entry, paymentStatus, updatedBy: actorId });
    });
    await this.auditLogs.log({
      entityName: 'CostEntry',
      entityId: dto.entryId,
      action: 'RECORD_VENDOR_PAYMENT',
      userId: actorId,
      newValues: {
        amount: dto.amount,
        paymentDate: dto.paymentDate,
        method: dto.method,
        accountRef: dto.accountRef,
        paymentStatus: updated.paymentStatus,
      },
    });
    return updated;
  }

  async getRevenueChart(filter: EntryFilterDto) {
    return this.getEntryChart(this.revRepo, 'r', filter);
  }

  async getCostChart(filter: EntryFilterDto) {
    return this.getEntryChart(this.costRepo, 'c', filter);
  }

  private async getEntryChart(repo: Repository<RevenueEntry | CostEntry>, alias: string, filter: EntryFilterDto) {
    const dateExpr = `COALESCE(${alias}.docDate, ${alias}.createdAt)`;
    const qb = repo.createQueryBuilder(alias)
      .select(`DATE_FORMAT(${dateExpr}, '%Y-%m')`, 'period')
      .addSelect(`SUM(${alias}.localAmount)`, 'totalAmount')
      .addSelect(`COUNT(${alias}.id)`, 'count')
      .where(`${alias}.status = :status`, { status: AccountingStatus.POSTED });
    if (filter.dateFrom) qb.andWhere(`${dateExpr} >= :dateFrom`, { dateFrom: filter.dateFrom });
    if (filter.dateTo) qb.andWhere(`${dateExpr} <= :dateTo`, { dateTo: filter.dateTo });
    if (filter.paymentStatus) qb.andWhere(`${alias}.paymentStatus = :paymentStatus`, { paymentStatus: filter.paymentStatus });
    qb.groupBy('period').orderBy('period', 'ASC');
    const rows = await qb.getRawMany();
    return {
      data: rows.map((r) => ({
        period: r.period,
        totalAmount: Number(r.totalAmount ?? 0),
        count: Number(r.count ?? 0),
      })),
    };
  }

  getPeriods() {
    return this.periodRepo.find({ order: { year: 'DESC', month: 'DESC' } });
  }

  async lockPeriod(dto: LockPeriodDto, actorId: number) {
    let period = await this.periodRepo.findOne({ where: { year: dto.year, month: dto.month } });
    if (!period) {
      period = this.periodRepo.create({ year: dto.year, month: dto.month, createdBy: actorId, updatedBy: actorId });
    }
    if (period.isLocked) throw new BadRequestException('Period is already locked');
    period.isLocked = true;
    period.lockedAt = new Date();
    period.lockedBy = actorId;
    period.updatedBy = actorId;
    const saved = await this.periodRepo.save(period);
    await this.auditLogs.log({ entityName: 'AccountingPeriod', entityId: saved.id, action: 'LOCK', userId: actorId, newValues: { year: saved.year, month: saved.month } });
    return saved;
  }

  async unlockPeriod(dto: LockPeriodDto, actorId: number) {
    const period = await this.periodRepo.findOne({ where: { year: dto.year, month: dto.month } });
    if (!period || !period.isLocked) throw new BadRequestException('Period is not locked');
    period.isLocked = false;
    period.unlockedAt = new Date();
    period.unlockedBy = actorId;
    period.updatedBy = actorId;
    const saved = await this.periodRepo.save(period);
    await this.auditLogs.log({ entityName: 'AccountingPeriod', entityId: saved.id, action: 'UNLOCK', userId: actorId, newValues: { year: saved.year, month: saved.month } });
    return saved;
  }
}
