import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JobsController } from './jobs.controller';
import { JobsService } from './jobs.service';
import { Job } from '../../models/job.entity';
import { JobMilestone } from '../../models/job-milestone.entity';
import { Partner } from '../../models/partner.entity';
import { Branch } from '../../models/branch.entity';
import { User } from '../../models/user.entity';
import { RevenueEntry } from '../../models/revenue-entry.entity';
import { CostEntry } from '../../models/cost-entry.entity';
import { DebitNote } from '../../models/debit-note.entity';
import { DebitNoteLine } from '../../models/debit-note-line.entity';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { CustomerDebtModule } from '../customer-debt/customer-debt.module';

@Module({
  imports: [TypeOrmModule.forFeature([Job, JobMilestone, Partner, Branch, User, RevenueEntry, CostEntry, DebitNote, DebitNoteLine]), AuditLogsModule, CustomerDebtModule],
  controllers: [JobsController],
  providers: [JobsService],
  exports: [JobsService],
})
export class JobsModule {}
