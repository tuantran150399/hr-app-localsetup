import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './config/database.module';
import { AuthModule } from './business/auth/auth.module';
import { UsersModule } from './business/users/users.module';
import { RolesModule } from './business/roles/roles.module';
import { BranchesModule } from './business/branches/branches.module';
import { PartnersModule } from './business/partners/partners.module';
import { JobsModule } from './business/jobs/jobs.module';
import { AccountingModule } from './business/accounting/accounting.module';
import { AuditLogsModule } from './business/audit-logs/audit-logs.module';
import { HealthModule } from './business/health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    AuthModule,
    UsersModule,
    RolesModule,
    BranchesModule,
    PartnersModule,
    JobsModule,
    AccountingModule,
    AuditLogsModule,
    HealthModule,
  ],
})
export class AppModule {}