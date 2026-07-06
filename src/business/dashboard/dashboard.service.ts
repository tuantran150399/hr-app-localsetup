import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Job, JobStatus } from '../../models/job.entity';
import { RevenueEntry, AccountingStatus } from '../../models/revenue-entry.entity';
import { CostEntry } from '../../models/cost-entry.entity';
import { AuthenticatedUser, getScopedBranchId } from '../../common/auth/branch-scope.util';

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(Job) private jobRepo: Repository<Job>,
    @InjectRepository(RevenueEntry) private revRepo: Repository<RevenueEntry>,
    @InjectRepository(CostEntry) private costRepo: Repository<CostEntry>,
  ) {}

  async getStats() {
    const [totalJobs, revenueAgg, costAgg] = await Promise.all([
      this.jobRepo.count({ where: { archivedAt: null } }),
      this.revRepo
        .createQueryBuilder('r')
        .select('COALESCE(SUM(r.local_amount), 0)', 'total')
        .where('r.status != :voided', { voided: AccountingStatus.VOIDED })
        .getRawOne<{ total: string }>(),
      this.costRepo
        .createQueryBuilder('c')
        .select('COALESCE(SUM(c.local_amount), 0)', 'total')
        .where('c.status != :voided', { voided: AccountingStatus.VOIDED })
        .getRawOne<{ total: string }>(),
    ]);

    const totalRevenue = Number(revenueAgg?.total ?? 0);
    const totalCost = Number(costAgg?.total ?? 0);

    return {
      totalJobs,
      totalRevenue,
      totalCost,
      profit: totalRevenue - totalCost,
    };
  }

  async getCompletedJobsProfit(actor?: AuthenticatedUser) {
    const branchId = getScopedBranchId(actor);
    const completedDate = 'COALESCE(j.closedAt, j.updatedAt)';

    const buildQuery = (repo: Repository<RevenueEntry | CostEntry>, alias: string) => {
      const qb = repo
        .createQueryBuilder(alias)
        .innerJoin(Job, 'j', `j.id = ${alias}.jobId`)
        .select(`DATE_FORMAT(${completedDate}, '%Y-%m')`, 'period')
        .addSelect(`SUM(${alias}.localAmount)`, 'totalAmount')
        .where(`${alias}.status = :entryStatus`, { entryStatus: AccountingStatus.POSTED })
        .andWhere('j.status = :jobStatus', { jobStatus: JobStatus.CLOSED })
        .andWhere('j.archivedAt IS NULL');
      if (branchId) qb.andWhere('j.branchId = :branchId', { branchId });
      return qb.groupBy('period').orderBy('period', 'ASC');
    };

    const completedJobsQb = this.jobRepo
      .createQueryBuilder('j')
      .where('j.status = :status', { status: JobStatus.CLOSED })
      .andWhere('j.archivedAt IS NULL');
    if (branchId) completedJobsQb.andWhere('j.branchId = :branchId', { branchId });

    const [revenueRows, costRows, completedJobs] = await Promise.all([
      buildQuery(this.revRepo, 'r').getRawMany<{ period: string; totalAmount: string }>(),
      buildQuery(this.costRepo, 'c').getRawMany<{ period: string; totalAmount: string }>(),
      completedJobsQb.getCount(),
    ]);

    const periods = new Map<string, { period: string; revenue: number; cost: number; profit: number }>();
    for (const row of revenueRows) {
      periods.set(row.period, { period: row.period, revenue: Number(row.totalAmount || 0), cost: 0, profit: 0 });
    }
    for (const row of costRows) {
      const current = periods.get(row.period) || { period: row.period, revenue: 0, cost: 0, profit: 0 };
      current.cost = Number(row.totalAmount || 0);
      periods.set(row.period, current);
    }

    const data = [...periods.values()]
      .map((row) => ({ ...row, profit: row.revenue - row.cost }))
      .sort((a, b) => a.period.localeCompare(b.period));
    const totals = data.reduce(
      (sum, row) => ({
        revenue: sum.revenue + row.revenue,
        cost: sum.cost + row.cost,
        profit: sum.profit + row.profit,
      }),
      { revenue: 0, cost: 0, profit: 0 },
    );

    return { completedJobs, totals, data };
  }
}
