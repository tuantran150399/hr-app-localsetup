import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Job, JobStatus } from '../../models/job.entity';
import { RevenueEntry, AccountingStatus, PaymentStatus } from '../../models/revenue-entry.entity';
import { CostEntry } from '../../models/cost-entry.entity';
import { Partner } from '../../models/partner.entity';
import { ReportFilterDto } from './dto/report-filter.dto';

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(Job) private jobRepo: Repository<Job>,
    @InjectRepository(RevenueEntry) private revRepo: Repository<RevenueEntry>,
    @InjectRepository(CostEntry) private costRepo: Repository<CostEntry>,
  ) {}

  // ─── Job profit ────────────────────────────────────────────────────────────

  /** Profit summary for a single job (POSTED entries only). */
  async profitByJob(jobId: number) {
    const [revEntries, costEntries] = await Promise.all([
      this.revRepo.find({ where: { jobId, status: AccountingStatus.POSTED } }),
      this.costRepo.find({ where: { jobId, status: AccountingStatus.POSTED } }),
    ]);
    const totalRevenue = revEntries.reduce((s, e) => s + Number(e.localAmount), 0);
    const totalCost = costEntries.reduce((s, e) => s + Number(e.localAmount), 0);
    return { jobId, totalRevenue, totalCost, profit: totalRevenue - totalCost };
  }

  // ─── Branch summary ────────────────────────────────────────────────────────

  /**
   * Revenue / Cost / Profit grouped by branch.
   * Uses raw query for aggregation efficiency.
   */
  async revenueByBranch(filter: ReportFilterDto) {
    const { dateFrom, dateTo } = filter;

    const revQb = this.revRepo
      .createQueryBuilder('r')
      .innerJoin(Job, 'j', 'j.id = r.jobId')
      .select('j.branchId', 'branchId')
      .addSelect('SUM(r.localAmount)', 'totalRevenue')
      .where('r.status = :s', { s: AccountingStatus.POSTED });
    if (dateFrom) revQb.andWhere('r.createdAt >= :dateFrom', { dateFrom });
    if (dateTo) revQb.andWhere('r.createdAt <= :dateTo', { dateTo });
    if (filter.branchId) revQb.andWhere('j.branchId = :branchId', { branchId: filter.branchId });
    revQb.groupBy('j.branchId');

    const costQb = this.costRepo
      .createQueryBuilder('c')
      .innerJoin(Job, 'j', 'j.id = c.jobId')
      .select('j.branchId', 'branchId')
      .addSelect('SUM(c.localAmount)', 'totalCost')
      .where('c.status = :s', { s: AccountingStatus.POSTED });
    if (dateFrom) costQb.andWhere('c.createdAt >= :dateFrom', { dateFrom });
    if (dateTo) costQb.andWhere('c.createdAt <= :dateTo', { dateTo });
    if (filter.branchId) costQb.andWhere('j.branchId = :branchId', { branchId: filter.branchId });
    costQb.groupBy('j.branchId');

    const [revRows, costRows] = await Promise.all([revQb.getRawMany(), costQb.getRawMany()]);

    const map = new Map<number, { branchId: number; totalRevenue: number; totalCost: number; profit: number }>();
    for (const r of revRows) {
      const id = Number(r.branchId);
      map.set(id, { branchId: id, totalRevenue: Number(r.totalRevenue ?? 0), totalCost: 0, profit: 0 });
    }
    for (const c of costRows) {
      const id = Number(c.branchId);
      const existing = map.get(id) ?? { branchId: id, totalRevenue: 0, totalCost: 0, profit: 0 };
      existing.totalCost = Number(c.totalCost ?? 0);
      map.set(id, existing);
    }
    const rows = [...map.values()].map((r) => ({ ...r, profit: r.totalRevenue - r.totalCost }));
    return { data: rows };
  }

  // ─── Customer (partner) summary ────────────────────────────────────────────

  async revenueByCustomer(filter: ReportFilterDto) {
    const { dateFrom, dateTo } = filter;

    const revQb = this.revRepo
      .createQueryBuilder('r')
      .innerJoin(Job, 'j', 'j.id = r.jobId')
      .select('j.partnerId', 'partnerId')
      .addSelect('SUM(r.localAmount)', 'totalRevenue')
      .where('r.status = :s', { s: AccountingStatus.POSTED });
    if (dateFrom) revQb.andWhere('r.createdAt >= :dateFrom', { dateFrom });
    if (dateTo) revQb.andWhere('r.createdAt <= :dateTo', { dateTo });
    if (filter.partnerId) revQb.andWhere('j.partnerId = :partnerId', { partnerId: filter.partnerId });
    revQb.groupBy('j.partnerId');

    const costQb = this.costRepo
      .createQueryBuilder('c')
      .innerJoin(Job, 'j', 'j.id = c.jobId')
      .select('j.partnerId', 'partnerId')
      .addSelect('SUM(c.localAmount)', 'totalCost')
      .where('c.status = :s', { s: AccountingStatus.POSTED });
    if (dateFrom) costQb.andWhere('c.createdAt >= :dateFrom', { dateFrom });
    if (dateTo) costQb.andWhere('c.createdAt <= :dateTo', { dateTo });
    if (filter.partnerId) costQb.andWhere('j.partnerId = :partnerId', { partnerId: filter.partnerId });
    costQb.groupBy('j.partnerId');

    const [revRows, costRows] = await Promise.all([revQb.getRawMany(), costQb.getRawMany()]);

    const map = new Map<number, { partnerId: number; totalRevenue: number; totalCost: number; profit: number }>();
    for (const r of revRows) {
      const id = Number(r.partnerId);
      map.set(id, { partnerId: id, totalRevenue: Number(r.totalRevenue ?? 0), totalCost: 0, profit: 0 });
    }
    for (const c of costRows) {
      const id = Number(c.partnerId);
      const existing = map.get(id) ?? { partnerId: id, totalRevenue: 0, totalCost: 0, profit: 0 };
      existing.totalCost = Number(c.totalCost ?? 0);
      map.set(id, existing);
    }
    const rows = [...map.values()].map((r) => ({ ...r, profit: r.totalRevenue - r.totalCost }));
    return { data: rows };
  }

  async pnlByPeriod(filter: ReportFilterDto) {
    if (filter.groupBy === 'job') return this.pnlByJob(filter);
    if (filter.groupBy === 'customer') return this.pnlByCustomer(filter);

    const groupBy = filter.groupBy ?? 'month';
    const [revenue, cost] = await Promise.all([
      this.periodSum(this.revRepo, 'r', filter, groupBy),
      this.periodSum(this.costRepo, 'c', filter, groupBy),
    ]);
    const map = new Map<string, { period: string; totalRevenue: number; totalCost: number; profit: number }>();
    for (const row of revenue) {
      map.set(row.period, { period: row.period, totalRevenue: row.totalAmount, totalCost: 0, profit: row.totalAmount });
    }
    for (const row of cost) {
      const existing = map.get(row.period) ?? { period: row.period, totalRevenue: 0, totalCost: 0, profit: 0 };
      existing.totalCost = row.totalAmount;
      existing.profit = existing.totalRevenue - existing.totalCost;
      map.set(row.period, existing);
    }
    return { data: [...map.values()].sort((a, b) => a.period.localeCompare(b.period)) };
  }

  async cashFlow(filter: ReportFilterDto) {
    const groupBy = ['month', 'quarter', 'year'].includes(filter.groupBy ?? '')
      ? filter.groupBy as 'month' | 'quarter' | 'year'
      : 'month';
    const [receipts, payments] = await Promise.all([
      this.periodSum(this.revRepo, 'r', filter, groupBy, [PaymentStatus.PAID]),
      this.periodSum(this.costRepo, 'c', filter, groupBy, [PaymentStatus.PAID]),
    ]);
    const map = new Map<string, { period: string; cashIn: number; cashOut: number; netCashFlow: number }>();
    for (const row of receipts) {
      map.set(row.period, { period: row.period, cashIn: row.totalAmount, cashOut: 0, netCashFlow: row.totalAmount });
    }
    for (const row of payments) {
      const existing = map.get(row.period) ?? { period: row.period, cashIn: 0, cashOut: 0, netCashFlow: 0 };
      existing.cashOut = row.totalAmount;
      existing.netCashFlow = existing.cashIn - existing.cashOut;
      map.set(row.period, existing);
    }
    return { data: [...map.values()].sort((a, b) => a.period.localeCompare(b.period)) };
  }

  private async periodSum(
    repo: Repository<RevenueEntry | CostEntry>,
    alias: string,
    filter: ReportFilterDto,
    groupBy: 'month' | 'quarter' | 'year',
    paymentStatuses?: PaymentStatus[],
  ) {
    const dateExpr = `COALESCE(${alias}.docDate, ${alias}.createdAt)`;
    const periodExpr = groupBy === 'year'
      ? `DATE_FORMAT(${dateExpr}, '%Y')`
      : groupBy === 'quarter'
        ? `CONCAT(YEAR(${dateExpr}), '-Q', QUARTER(${dateExpr}))`
        : `DATE_FORMAT(${dateExpr}, '%Y-%m')`;
    const qb = repo.createQueryBuilder(alias)
      .innerJoin(Job, 'j', `j.id = ${alias}.jobId`)
      .select(periodExpr, 'period')
      .addSelect(`SUM(${alias}.localAmount)`, 'totalAmount')
      .where(`${alias}.status = :status`, { status: AccountingStatus.POSTED });
    if (filter.dateFrom) qb.andWhere(`${dateExpr} >= :dateFrom`, { dateFrom: filter.dateFrom });
    if (filter.dateTo) qb.andWhere(`${dateExpr} <= :dateTo`, { dateTo: filter.dateTo });
    if (filter.branchId) qb.andWhere('j.branchId = :branchId', { branchId: filter.branchId });
    if (filter.partnerId) qb.andWhere('j.partnerId = :partnerId', { partnerId: filter.partnerId });
    if (paymentStatuses?.length) qb.andWhere(`${alias}.paymentStatus IN (:...paymentStatuses)`, { paymentStatuses });
    qb.groupBy('period').orderBy('period', 'ASC');
    const rows = await qb.getRawMany();
    return rows.map((row) => ({ period: row.period, totalAmount: Number(row.totalAmount ?? 0) }));
  }

  private async pnlByJob(filter: ReportFilterDto) {
    const [revenue, cost] = await Promise.all([
      this.groupSum(this.revRepo, 'r', filter, 'j.id', ['j.jobCode']),
      this.groupSum(this.costRepo, 'c', filter, 'j.id', ['j.jobCode']),
    ]);
    const map = new Map<number, { jobId: number; jobCode: string; totalRevenue: number; totalCost: number; profit: number }>();
    for (const row of revenue) {
      map.set(row.id, { jobId: row.id, jobCode: row.label ?? '', totalRevenue: row.totalAmount, totalCost: 0, profit: row.totalAmount });
    }
    for (const row of cost) {
      const existing = map.get(row.id) ?? { jobId: row.id, jobCode: row.label ?? '', totalRevenue: 0, totalCost: 0, profit: 0 };
      existing.totalCost = row.totalAmount;
      existing.profit = existing.totalRevenue - existing.totalCost;
      map.set(row.id, existing);
    }
    return { data: [...map.values()].sort((a, b) => a.jobCode.localeCompare(b.jobCode)) };
  }

  private async pnlByCustomer(filter: ReportFilterDto) {
    const [revenue, cost] = await Promise.all([
      this.groupSum(this.revRepo, 'r', filter, 'j.partnerId', ['p.name']),
      this.groupSum(this.costRepo, 'c', filter, 'j.partnerId', ['p.name']),
    ]);
    const map = new Map<number, { partnerId: number; partnerName: string; totalRevenue: number; totalCost: number; profit: number }>();
    for (const row of revenue) {
      map.set(row.id, { partnerId: row.id, partnerName: row.label ?? '', totalRevenue: row.totalAmount, totalCost: 0, profit: row.totalAmount });
    }
    for (const row of cost) {
      const existing = map.get(row.id) ?? { partnerId: row.id, partnerName: row.label ?? '', totalRevenue: 0, totalCost: 0, profit: 0 };
      existing.totalCost = row.totalAmount;
      existing.profit = existing.totalRevenue - existing.totalCost;
      map.set(row.id, existing);
    }
    return { data: [...map.values()].sort((a, b) => a.partnerName.localeCompare(b.partnerName)) };
  }

  private async groupSum(
    repo: Repository<RevenueEntry | CostEntry>,
    alias: string,
    filter: ReportFilterDto,
    groupColumn: string,
    labelColumns: string[],
  ) {
    const dateExpr = `COALESCE(${alias}.docDate, ${alias}.createdAt)`;
    const qb = repo.createQueryBuilder(alias)
      .innerJoin(Job, 'j', `j.id = ${alias}.jobId`)
      .leftJoin(Partner, 'p', 'p.id = j.partnerId')
      .select(groupColumn, 'id')
      .addSelect(labelColumns[0], 'label')
      .addSelect(`SUM(${alias}.localAmount)`, 'totalAmount')
      .where(`${alias}.status = :status`, { status: AccountingStatus.POSTED });
    if (filter.dateFrom) qb.andWhere(`${dateExpr} >= :dateFrom`, { dateFrom: filter.dateFrom });
    if (filter.dateTo) qb.andWhere(`${dateExpr} <= :dateTo`, { dateTo: filter.dateTo });
    if (filter.branchId) qb.andWhere('j.branchId = :branchId', { branchId: filter.branchId });
    if (filter.partnerId) qb.andWhere('j.partnerId = :partnerId', { partnerId: filter.partnerId });
    qb.groupBy(groupColumn).addGroupBy(labelColumns[0]);
    const rows = await qb.getRawMany();
    return rows.map((row) => ({ id: Number(row.id), label: row.label, totalAmount: Number(row.totalAmount ?? 0) }));
  }

  // ─── Job status summary ────────────────────────────────────────────────────

  async jobStatusSummary(filter: ReportFilterDto) {
    const qb = this.jobRepo.createQueryBuilder('j')
      .select('j.status', 'status')
      .addSelect('COUNT(j.id)', 'count');
    if (filter.dateFrom) qb.andWhere('j.createdAt >= :dateFrom', { dateFrom: filter.dateFrom });
    if (filter.dateTo) qb.andWhere('j.createdAt <= :dateTo', { dateTo: filter.dateTo });
    if (filter.branchId) qb.andWhere('j.branchId = :branchId', { branchId: filter.branchId });
    qb.groupBy('j.status');
    const rows = await qb.getRawMany();
    return { data: rows.map((r) => ({ status: r.status, count: Number(r.count) })) };
  }

  // ─── Receivable / Payable summary ─────────────────────────────────────────

  /** Outstanding (UNPAID + PARTIAL) posted revenue entries = receivables */
  async receivableSummary(filter: ReportFilterDto) {
    const qb = this.revRepo.createQueryBuilder('r')
      .innerJoin(Job, 'j', 'j.id = r.jobId')
      .select('r.paymentStatus', 'paymentStatus')
      .addSelect('SUM(r.localAmount)', 'totalAmount')
      .addSelect('COUNT(r.id)', 'count')
      .where('r.status = :s', { s: AccountingStatus.POSTED })
      .andWhere('r.paymentStatus IN (:...ps)', { ps: [PaymentStatus.UNPAID, PaymentStatus.PARTIAL] });
    if (filter.dateFrom) qb.andWhere('r.createdAt >= :dateFrom', { dateFrom: filter.dateFrom });
    if (filter.dateTo) qb.andWhere('r.createdAt <= :dateTo', { dateTo: filter.dateTo });
    if (filter.branchId) qb.andWhere('j.branchId = :branchId', { branchId: filter.branchId });
    if (filter.partnerId) qb.andWhere('j.partnerId = :partnerId', { partnerId: filter.partnerId });
    qb.groupBy('r.paymentStatus');
    const rows = await qb.getRawMany();
    return {
      data: rows.map((r) => ({ paymentStatus: r.paymentStatus, count: Number(r.count), totalAmount: Number(r.totalAmount ?? 0) })),
    };
  }

  /** Outstanding posted cost entries = payables */
  async payableSummary(filter: ReportFilterDto) {
    const qb = this.costRepo.createQueryBuilder('c')
      .innerJoin(Job, 'j', 'j.id = c.jobId')
      .select('c.paymentStatus', 'paymentStatus')
      .addSelect('SUM(c.localAmount)', 'totalAmount')
      .addSelect('COUNT(c.id)', 'count')
      .where('c.status = :s', { s: AccountingStatus.POSTED })
      .andWhere('c.paymentStatus IN (:...ps)', { ps: [PaymentStatus.UNPAID, PaymentStatus.PARTIAL] });
    if (filter.dateFrom) qb.andWhere('c.createdAt >= :dateFrom', { dateFrom: filter.dateFrom });
    if (filter.dateTo) qb.andWhere('c.createdAt <= :dateTo', { dateTo: filter.dateTo });
    if (filter.branchId) qb.andWhere('j.branchId = :branchId', { branchId: filter.branchId });
    qb.groupBy('c.paymentStatus');
    const rows = await qb.getRawMany();
    return {
      data: rows.map((r) => ({ paymentStatus: r.paymentStatus, count: Number(r.count), totalAmount: Number(r.totalAmount ?? 0) })),
    };
  }

  // ─── Overdue receivables / payables ───────────────────────────────────────

  /**
   * Revenue entries that are POSTED, not fully PAID, and whose dueDate < today.
   */
  async overdueReceivables(filter: ReportFilterDto) {
    const today = new Date().toISOString().split('T')[0];
    const qb = this.revRepo.createQueryBuilder('r')
      .innerJoin(Job, 'j', 'j.id = r.jobId')
      .where('r.status = :s', { s: AccountingStatus.POSTED })
      .andWhere('r.paymentStatus != :paid', { paid: PaymentStatus.PAID })
      .andWhere('r.dueDate IS NOT NULL')
      .andWhere('r.dueDate < :today', { today })
      .orderBy('r.dueDate', 'ASC');
    if (filter.branchId) qb.andWhere('j.branchId = :branchId', { branchId: filter.branchId });
    if (filter.partnerId) qb.andWhere('j.partnerId = :partnerId', { partnerId: filter.partnerId });
    const rows = await qb.getMany();
    const total = rows.reduce((s, r) => s + Number(r.localAmount), 0);
    return { count: rows.length, totalAmount: total, data: rows };
  }

  async overduePayables(filter: ReportFilterDto) {
    const today = new Date().toISOString().split('T')[0];
    const qb = this.costRepo.createQueryBuilder('c')
      .innerJoin(Job, 'j', 'j.id = c.jobId')
      .where('c.status = :s', { s: AccountingStatus.POSTED })
      .andWhere('c.paymentStatus != :paid', { paid: PaymentStatus.PAID })
      .andWhere('c.dueDate IS NOT NULL')
      .andWhere('c.dueDate < :today', { today })
      .orderBy('c.dueDate', 'ASC');
    if (filter.branchId) qb.andWhere('j.branchId = :branchId', { branchId: filter.branchId });
    const rows = await qb.getMany();
    const total = rows.reduce((s, c) => s + Number(c.localAmount), 0);
    return { count: rows.length, totalAmount: total, data: rows };
  }
}
