import { Controller, Get, Param, ParseIntPipe, UseGuards, Query } from '@nestjs/common';
import { AuditLogsService } from './audit-logs.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../auth/guards/permission.guard';
import { RequirePermission } from '../auth/decorators/require-permission.decorator';

@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('audit-logs')
export class AuditLogsController {
  constructor(private svc: AuditLogsService) {}

  /**
   * GET /audit-logs?page=1&limit=50&entityName=Job&userId=3&action=CREATE&dateFrom=2026-01-01&dateTo=2026-12-31
   */
  @RequirePermission('auditlog:view')
  @Get()
  findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('entityName') entityName?: string,
    @Query('entityId') entityId?: string,
    @Query('userId') userId?: string,
    @Query('action') action?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    return this.svc.findAll({
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 50,
      entityName,
      entityId: entityId ? Number(entityId) : undefined,
      userId: userId ? Number(userId) : undefined,
      action,
      dateFrom,
      dateTo,
    });
  }

  @RequirePermission('auditlog:view')
  @Get(':entity/:id')
  findByEntity(@Param('entity') entity: string, @Param('id', ParseIntPipe) id: number) {
    return this.svc.findByEntity(entity, id);
  }
}