import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../auth/guards/permission.guard';
import { RequirePermission } from '../auth/decorators/require-permission.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { SecurityService } from './security.service';
import {
  CreateIpAccessRuleDto,
  CreateBlockedIpDto,
  IpAccessRuleFilterDto,
  SecurityAlertFilterDto,
  SecurityLoginEventFilterDto,
  UpdateIpAccessRuleDto,
  UpdateSecurityAlertStatusDto,
} from './dto/security.dto';

@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('security')
export class SecurityController {
  constructor(private readonly svc: SecurityService) {}

  @RequirePermission('security:view')
  @Get('login-events')
  findLoginEvents(@Query() filter: SecurityLoginEventFilterDto) {
    return this.svc.findLoginEvents(filter);
  }

  @RequirePermission('security:view')
  @Get('alerts')
  findAlerts(@Query() filter: SecurityAlertFilterDto) {
    return this.svc.findAlerts(filter);
  }

  @RequirePermission('security:view')
  @Get('features')
  getFeatures() {
    return this.svc.getFeatures();
  }

  @RequirePermission('security:manage')
  @Patch('alerts/:id/status')
  updateAlertStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateSecurityAlertStatusDto,
    @CurrentUser() user: { id: number },
  ) {
    return this.svc.updateAlertStatus(id, dto.status, user.id);
  }

  @RequirePermission('security:view')
  @Get('ip-rules')
  findIpRules(@Query() filter: IpAccessRuleFilterDto) {
    return this.svc.findIpRules(filter);
  }

  @RequirePermission('security:manage')
  @Post('ip-rules')
  createIpRule(@Body() dto: CreateIpAccessRuleDto, @CurrentUser() user: { id: number }) {
    return this.svc.createIpRule(dto, user.id);
  }

  @RequirePermission('security:manage')
  @Patch('ip-rules/:id')
  updateIpRule(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateIpAccessRuleDto,
    @CurrentUser() user: { id: number },
  ) {
    return this.svc.updateIpRule(id, dto, user.id);
  }

  @RequirePermission('security:manage')
  @Delete('ip-rules/:id')
  deleteIpRule(@Param('id', ParseIntPipe) id: number) {
    return this.svc.deleteIpRule(id);
  }

  @RequirePermission('security:view')
  @Get('blocked-ips')
  findBlockedIps(@Query() filter: IpAccessRuleFilterDto) {
    return this.svc.findBlockedIps(filter);
  }

  @RequirePermission('security:manage')
  @Post('blocked-ips')
  blockIp(@Body() dto: CreateBlockedIpDto, @CurrentUser() user: { id: number }) {
    return this.svc.blockIp(dto, user.id);
  }

  @RequirePermission('security:manage')
  @Delete('blocked-ips/:id')
  unblockIp(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: { id: number }) {
    return this.svc.unblockIp(id, user.id);
  }
}
