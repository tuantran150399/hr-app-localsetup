import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MulterModule } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { PricingController } from './pricing.controller';
import { PricingService } from './pricing.service';
import { ServicePrice } from '../../models/service-price.entity';
import { Partner } from '../../models/partner.entity';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ServicePrice, Partner]),
    AuditLogsModule,
    MulterModule.register({ storage: memoryStorage() }),
  ],
  controllers: [PricingController],
  providers: [PricingService],
  exports: [PricingService],
})
export class PricingModule {}
