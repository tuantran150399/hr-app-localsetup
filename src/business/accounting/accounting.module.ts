import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AccountingController } from './accounting.controller';
import { AccountingService } from './accounting.service';
import { RevenueEntry } from '../../models/revenue-entry.entity';
import { CostEntry } from '../../models/cost-entry.entity';
import { Job } from '../../models/job.entity';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';

@Module({
  imports: [TypeOrmModule.forFeature([RevenueEntry, CostEntry, Job]), AuditLogsModule],
  controllers: [AccountingController],
  providers: [AccountingService],
})
export class AccountingModule {}
