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
import { ReportsModule } from './business/reports/reports.module';
import { DashboardModule } from './business/dashboard/dashboard.module';
import { PaymentRequestsModule } from './business/payment-requests/payment-requests.module';
import { DebtPoliciesModule } from './business/debt-policies/debt-policies.module';
import { PricingModule } from './business/pricing/pricing.module';
import { HrModule } from './business/hr/hr.module';
import { AdvancesModule } from './business/advances/advances.module';
import { TreasuryModule } from './business/treasury/treasury.module';
import { getEnvFilePath } from './config/env-file-path';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: getEnvFilePath(),
    }),
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
    ReportsModule,
    DashboardModule,
    PaymentRequestsModule,
    DebtPoliciesModule,
    PricingModule,
    HrModule,
    AdvancesModule,
    TreasuryModule,
  ],
})
export class AppModule {}
