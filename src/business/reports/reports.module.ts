import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { Job } from '../../models/job.entity';
import { RevenueEntry } from '../../models/revenue-entry.entity';
import { CostEntry } from '../../models/cost-entry.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Job, RevenueEntry, CostEntry])],
  controllers: [ReportsController],
  providers: [ReportsService],
})
export class ReportsModule {}
