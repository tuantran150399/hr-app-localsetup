import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Not, Repository } from 'typeorm';
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
    const [totalJobs, revenueRows, costRows] = await Promise.all([
      this.jobRepo.count({ where: { archivedAt: null } }),
      this.revRepo.find({ where: { status: Not(AccountingStatus.VOIDED) } }),
      this.costRepo.find({ where: { status: Not(AccountingStatus.VOIDED) } }),
    ]);

    const totalRevenue = revenueRows.reduce((sum, item) => sum + Number(item.localAmount ?? item.amount ?? 0), 0);
    const totalCost = costRows.reduce((sum, item) => sum + Number(item.localAmount ?? item.amount ?? 0), 0);

    return {
      totalJobs,
      totalRevenue,
      totalCost,
      profit: totalRevenue - totalCost,
    };
  }
}
