import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CustomerDebtService } from './customer-debt.service';
import { DebtPolicy } from '../../models/debt-policy.entity';
import { Job } from '../../models/job.entity';
import { Partner } from '../../models/partner.entity';

@Module({
  imports: [TypeOrmModule.forFeature([DebtPolicy, Job, Partner])],
  providers: [CustomerDebtService],
  exports: [CustomerDebtService],
})
export class CustomerDebtModule {}
