import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdvancesController } from './advances.controller';
import { AdvancesService } from './advances.service';
import { EmployeeAdvance } from '../../models/employee-advance.entity';
import { Employee } from '../../models/employee.entity';
import { Job } from '../../models/job.entity';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';

@Module({
  imports: [TypeOrmModule.forFeature([EmployeeAdvance, Employee, Job]), AuditLogsModule],
  controllers: [AdvancesController],
  providers: [AdvancesService],
})
export class AdvancesModule {}
