import { Controller, Get, Param, ParseIntPipe, UseGuards, Query } from '@nestjs/common';
import { AuditLogsService } from './audit-logs.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../auth/guards/permission.guard';
import { RequirePermission } from '../auth/decorators/require-permission.decorator';

@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('audit-logs')
export class AuditLogsController {
  constructor(private svc: AuditLogsService) {}

  @RequirePermission('auditlog:view')
  @Get()
  findAll(@Query('limit') limit?: number) {
    return this.svc.findAll(limit ? Number(limit) : 100);
  }

  @RequirePermission('auditlog:view')
  @Get(':entity/:id')
  findByEntity(@Param('entity') entity: string, @Param('id', ParseIntPipe) id: number) {
    return this.svc.findByEntity(entity, id);
  }
}