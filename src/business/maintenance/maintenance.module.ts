import { Module } from '@nestjs/common';
import { MaintenanceController } from './maintenance.controller';
import { DatabasePurgeGuard } from './database-purge.guard';
import { MaintenanceService } from './maintenance.service';

@Module({
  controllers: [MaintenanceController],
  providers: [MaintenanceService, DatabasePurgeGuard],
})
export class MaintenanceModule {}
