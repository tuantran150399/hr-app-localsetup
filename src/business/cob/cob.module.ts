import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CobController } from './cob.controller';
import { CobService } from './cob.service';
import { CobEntry } from '../../models/cob-entry.entity';
import { CostEntry } from '../../models/cost-entry.entity';
import { RevenueEntry } from '../../models/revenue-entry.entity';
import { Job } from '../../models/job.entity';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { CustomerDebtModule } from '../customer-debt/customer-debt.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([CobEntry, CostEntry, RevenueEntry, Job]),
    AuditLogsModule,
    CustomerDebtModule,
  ],
  controllers: [CobController],
  providers: [CobService],
  exports: [CobService],
})
export class CobModule {}
