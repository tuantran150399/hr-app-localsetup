import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DebtPoliciesController } from './debt-policies.controller';
import { DebtPoliciesService } from './debt-policies.service';
import { DebtPolicy } from '../../models/debt-policy.entity';
import { Partner } from '../../models/partner.entity';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';

@Module({
  imports: [TypeOrmModule.forFeature([DebtPolicy, Partner]), AuditLogsModule],
  controllers: [DebtPoliciesController],
  providers: [DebtPoliciesService],
})
export class DebtPoliciesModule {}
