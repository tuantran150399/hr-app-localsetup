import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { AdjustmentsService } from './adjustments.service';
import { CreateAdjustmentDto, AdjustmentFilterDto } from './dto/adjustment.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../auth/guards/permission.guard';
import { RequirePermission } from '../auth/decorators/require-permission.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('accounting/adjustments')
export class AdjustmentsController {
  constructor(private svc: AdjustmentsService) {}

  @RequirePermission('accounting:post')
  @Post()
  create(@Body() dto: CreateAdjustmentDto, @CurrentUser() user: { id: number }) {
    return this.svc.create(dto, user.id);
  }

  @RequirePermission('accounting:view')
  @Get()
  findAll(@Query() filter: AdjustmentFilterDto) {
    return this.svc.findAll(filter);
  }

  @RequirePermission('accounting:view')
  @Get('job/:jobId')
  getJobSummary(@Param('jobId', ParseIntPipe) jobId: number) {
    return this.svc.getJobAdjustmentSummary(jobId);
  }

  @RequirePermission('accounting:view')
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.svc.findOne(id);
  }

  @RequirePermission('accounting:post')
  @Patch(':id/approve')
  approve(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: { id: number }) {
    return this.svc.approve(id, user.id);
  }

  @RequirePermission('accounting:post')
  @Delete(':id')
  delete(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: { id: number }) {
    return this.svc.delete(id, user.id);
  }
}
