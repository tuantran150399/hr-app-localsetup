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
import { DebtPolicy } from '../../models/debt-policy.entity';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';

@Module({
  imports: [TypeOrmModule.forFeature([Job, JobMilestone, Partner, Branch, User, RevenueEntry, CostEntry, DebtPolicy]), AuditLogsModule],
  controllers: [JobsController],
  providers: [JobsService],
  exports: [JobsService],
})
export class JobsModule {}
