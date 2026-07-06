import { Controller, Post, UseGuards } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { DatabasePurgeGuard } from './database-purge.guard';
import { MaintenanceService } from './maintenance.service';

@ApiExcludeController()
@UseGuards(DatabasePurgeGuard)
@Controller('maintenance')
export class MaintenanceController {
  constructor(private readonly maintenanceService: MaintenanceService) {}

  @Post('database/drop-all-tables')
  dropAllTables() {
    return this.maintenanceService.dropAllTables();
  }
}
