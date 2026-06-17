import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DebitNotesController } from './debit-notes.controller';
import { DebitNotesService } from './debit-notes.service';
import { DebitNote } from '../../models/debit-note.entity';
import { DebitNoteLine } from '../../models/debit-note-line.entity';
import { ServicePrice } from '../../models/service-price.entity';
import { Job } from '../../models/job.entity';
import { RevenueEntry } from '../../models/revenue-entry.entity';
import { Partner } from '../../models/partner.entity';
import { Branch } from '../../models/branch.entity';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([DebitNote, DebitNoteLine, ServicePrice, Job, RevenueEntry, Partner, Branch]),
    AuditLogsModule,
  ],
  controllers: [DebitNotesController],
  providers: [DebitNotesService],
  exports: [DebitNotesService],
})
export class DebitNotesModule {}
