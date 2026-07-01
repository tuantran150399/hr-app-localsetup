import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { IpAccessRule } from '../../models/ip-access-rule.entity';
import { SecurityAlert } from '../../models/security-alert.entity';
import { SecurityLoginEvent } from '../../models/security-login-event.entity';
import { SecurityController } from './security.controller';
import { SecurityService } from './security.service';
import { LoginHistoryCleanupService } from './login-history-cleanup.service';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';

@Module({
  imports: [ScheduleModule.forRoot(), TypeOrmModule.forFeature([SecurityLoginEvent, SecurityAlert, IpAccessRule]), AuditLogsModule],
  controllers: [SecurityController],
  providers: [SecurityService, LoginHistoryCleanupService],
  exports: [SecurityService],
})
export class SecurityModule {}
