import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CustomerDebtService } from './customer-debt.service';
import { DebtPolicy } from '../../models/debt-policy.entity';
import { Job } from '../../models/job.entity';
import { Partner } from '../../models/partner.entity';
import { RevenueEntry } from '../../models/revenue-entry.entity';
import { DebitNote } from '../../models/debit-note.entity';
import { CobEntry } from '../../models/cob-entry.entity';
import { CustomerDebtController } from './customer-debt.controller';

@Module({
  imports: [TypeOrmModule.forFeature([DebtPolicy, Job, Partner, RevenueEntry, DebitNote, CobEntry])],
  controllers: [CustomerDebtController],
  providers: [CustomerDebtService],
  exports: [CustomerDebtService],
})
export class CustomerDebtModule {}
