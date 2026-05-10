import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Job } from '../../models/job.entity';
import { RevenueEntry, AccountingStatus } from '../../models/revenue-entry.entity';
import { CostEntry } from '../../models/cost-entry.entity';

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
}
