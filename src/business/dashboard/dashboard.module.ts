import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { Job } from '../../models/job.entity';
import { RevenueEntry } from '../../models/revenue-entry.entity';
import { CostEntry } from '../../models/cost-entry.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Job, RevenueEntry, CostEntry])],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
