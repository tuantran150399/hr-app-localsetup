import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PartnersController } from './partners.controller';
import { PartnersService } from './partners.service';
import { Partner } from '../../models/partner.entity';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { CustomerDebtModule } from '../customer-debt/customer-debt.module';

@Module({
  imports: [TypeOrmModule.forFeature([Partner]), AuditLogsModule, CustomerDebtModule],
  controllers: [PartnersController],
  providers: [PartnersService],
})
export class PartnersModule {}
