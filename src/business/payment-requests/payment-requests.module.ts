import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentRequestsController } from './payment-requests.controller';
import { PaymentRequestsService } from './payment-requests.service';
import { PaymentRequest } from '../../models/payment-request.entity';
import { Partner } from '../../models/partner.entity';
import { Job } from '../../models/job.entity';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { User } from '../../models/user.entity';
import { Employee } from '../../models/employee.entity';
import { CustomerDebtModule } from '../customer-debt/customer-debt.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([PaymentRequest, Partner, Job, User, Employee]),
    AuditLogsModule,
    NotificationsModule,
    CustomerDebtModule,
  ],
  controllers: [PaymentRequestsController],
  providers: [PaymentRequestsService],
})
export class PaymentRequestsModule {}
