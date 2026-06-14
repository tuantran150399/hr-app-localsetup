import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Put, Query, UseGuards } from '@nestjs/common';
import { AdvancesService } from './advances.service';
import { AdvanceFilterDto, CreateAdvanceDto, RejectAdvanceDto, SettleAdvanceDto, UpdateAdvanceDto } from './dto/advance.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../auth/guards/permission.guard';
import { RequirePermission } from '../auth/decorators/require-permission.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('advances')
export class AdvancesController {
  constructor(private svc: AdvancesService) {}

  @RequirePermission('advance:manage')
  @Post()
  create(@Body() dto: CreateAdvanceDto, @CurrentUser() user: { id: number; branchId?: number; roles?: string[] }) {
    return this.svc.create(dto, user.id, user);
  }

  @RequirePermission('advance:view')
  @Get()
  findAll(@Query() filter: AdvanceFilterDto, @CurrentUser() user: { id: number; branchId?: number; roles?: string[] }) {
    return this.svc.findAll(filter, user);
  }

  @RequirePermission('advance:view')
  @Get('overdue')
  overdue() {
    return this.svc.overdue();
  }

  @RequirePermission('advance:view')
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: { id: number; branchId?: number; roles?: string[] }) {
    return this.svc.findOne(id, user);
  }

  @RequirePermission('advance:manage')
  @Put(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateAdvanceDto, @CurrentUser() user: { id: number; branchId?: number; roles?: string[] }) {
    return this.svc.update(id, dto, user.id, user);
  }

  @RequirePermission('advance:manage')
  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: { id: number; branchId?: number; roles?: string[] }) {
    return this.svc.remove(id, user.id, user);
  }

  @RequirePermission('advance:manage')
  @Patch(':id/approve')
  approve(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: { id: number; branchId?: number; roles?: string[] }) {
    return this.svc.approve(id, user.id, user);
  }

  @RequirePermission('advance:manage')
  @Patch(':id/reject')
  reject(@Param('id', ParseIntPipe) id: number, @Body() dto: RejectAdvanceDto, @CurrentUser() user: { id: number; branchId?: number; roles?: string[] }) {
    return this.svc.reject(id, dto, user.id, user);
  }

  @RequirePermission('advance:manage')
  @Patch(':id/settle')
  settle(@Param('id', ParseIntPipe) id: number, @Body() dto: SettleAdvanceDto, @CurrentUser() user: { id: number; branchId?: number; roles?: string[] }) {
    return this.svc.settle(id, dto, user.id, user);
  }
}
