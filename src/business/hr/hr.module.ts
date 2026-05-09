import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HrController } from './hr.controller';
import { HrService } from './hr.service';
import { Employee } from '../../models/employee.entity';
import { AttendanceRecord } from '../../models/attendance-record.entity';
import { LeaveRequest } from '../../models/leave-request.entity';
import { PayrollRecord } from '../../models/payroll-record.entity';
import { Branch } from '../../models/branch.entity';
import { User } from '../../models/user.entity';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';

@Module({
  imports: [TypeOrmModule.forFeature([Employee, AttendanceRecord, LeaveRequest, PayrollRecord, Branch, User]), AuditLogsModule],
  controllers: [HrController],
  providers: [HrService],
  exports: [HrService],
})
export class HrModule {}
