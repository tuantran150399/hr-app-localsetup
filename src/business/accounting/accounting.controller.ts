import { Controller, Get, Post, Patch, Delete, Body, Param, ParseIntPipe, UseGuards, Query } from '@nestjs/common';
import { AccountingService } from './accounting.service';
import { CreateEntryDto, UpdateEntryDto, EntryFilterDto, UpdatePaymentStatusDto, VoidEntryDto, LockPeriodDto } from './dto/entry.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../auth/guards/permission.guard';
import { RequirePermission } from '../auth/decorators/require-permission.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('accounting')
export class AccountingController {
  constructor(private svc: AccountingService) {}

  // ─── Revenue ──────────────────────────────────────────────────────────────

  @RequirePermission('accounting:create')
  @Post('revenue')
  createRevenue(@Body() dto: CreateEntryDto, @CurrentUser() user: { id: number }) {
    return this.svc.createRevenue(dto, user.id);
  }

  @Get('revenue')
  findRevenue(@Query() filter: EntryFilterDto) {
    return this.svc.findRevenue(filter);
  }

  @Get('revenue/job/:jobId')
  revenueByJob(@Param('jobId', ParseIntPipe) jobId: number) {
    return this.svc.findRevenueByJob(jobId);
  }

  @RequirePermission('accounting:create')
  @Patch('revenue/:id')
  updateRevenue(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateEntryDto, @CurrentUser() user: { id: number }) {
    return this.svc.updateRevenue(id, dto, user.id);
  }

  @RequirePermission('accounting:post')
  @Patch('revenue/:id/post')
  postRevenue(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: { id: number }) {
    return this.svc.postRevenue(id, user.id);
  }

  /** Void a posted revenue entry and create a reversal. Requires accounting:post permission. */
  @RequirePermission('accounting:post')
  @Post('revenue/:id/void')
  voidRevenue(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: VoidEntryDto,
    @CurrentUser() user: { id: number },
  ) {
    return this.svc.voidRevenue(id, user.id, dto.reason);
  }

  /** Update payment status on a POSTED revenue entry. */
  @RequirePermission('accounting:post')
  @Patch('revenue/:id/payment-status')
  updateRevenuePayment(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdatePaymentStatusDto,
    @CurrentUser() user: { id: number },
  ) {
    return this.svc.updateRevenuePaymentStatus(id, dto, user.id);
  }

  @RequirePermission('accounting:create')
  @Delete('revenue/:id')
  deleteRevenue(@Param('id', ParseIntPipe) id: number) {
    return this.svc.deleteRevenue(id);
  }

  // ─── Cost ─────────────────────────────────────────────────────────────────

  @RequirePermission('accounting:create')
  @Post('cost')
  createCost(@Body() dto: CreateEntryDto, @CurrentUser() user: { id: number }) {
    return this.svc.createCost(dto, user.id);
  }

  @Get('cost')
  findCost(@Query() filter: EntryFilterDto) {
    return this.svc.findCost(filter);
  }

  @Get('cost/job/:jobId')
  costByJob(@Param('jobId', ParseIntPipe) jobId: number) {
    return this.svc.findCostByJob(jobId);
  }

  @RequirePermission('accounting:create')
  @Patch('cost/:id')
  updateCost(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateEntryDto, @CurrentUser() user: { id: number }) {
    return this.svc.updateCost(id, dto, user.id);
  }

  @RequirePermission('accounting:post')
  @Patch('cost/:id/post')
  postCost(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: { id: number }) {
    return this.svc.postCost(id, user.id);
  }

  @RequirePermission('accounting:post')
  @Post('cost/:id/void')
  voidCost(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: VoidEntryDto,
    @CurrentUser() user: { id: number },
  ) {
    return this.svc.voidCost(id, user.id, dto.reason);
  }

  @RequirePermission('accounting:post')
  @Patch('cost/:id/payment-status')
  updateCostPayment(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdatePaymentStatusDto,
    @CurrentUser() user: { id: number },
  ) {
    return this.svc.updateCostPaymentStatus(id, dto, user.id);
  }

  @RequirePermission('accounting:create')
  @Delete('cost/:id')
  deleteCost(@Param('id', ParseIntPipe) id: number) {
    return this.svc.deleteCost(id);
  }

  // ─── Post all + Profit ────────────────────────────────────────────────────

  @RequirePermission('accounting:post')
  @Post('post-all/job/:jobId')
  postAllForJob(@Param('jobId', ParseIntPipe) jobId: number, @CurrentUser() user: { id: number }) {
    return this.svc.postAllForJob(jobId, user.id);
  }

  @Get('profit/job/:jobId')
  profitByJob(@Param('jobId', ParseIntPipe) jobId: number) {
    return this.svc.getProfitSummary(jobId);
  }

  // ─── Period Lock (admin only) ─────────────────────────────────────────────

  @RequirePermission('accounting:post')
  @Get('periods')
  getPeriods() {
    return this.svc.getPeriods();
  }

  @RequirePermission('accounting:post')
  @Post('periods/lock')
  lockPeriod(@Body() dto: LockPeriodDto, @CurrentUser() user: { id: number }) {
    return this.svc.lockPeriod(dto, user.id);
  }

  @RequirePermission('accounting:post')
  @Post('periods/unlock')
  unlockPeriod(@Body() dto: LockPeriodDto, @CurrentUser() user: { id: number }) {
    return this.svc.unlockPeriod(dto, user.id);
  }
}
