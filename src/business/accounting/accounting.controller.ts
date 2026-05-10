import { BadRequestException, Body, Controller, Get, Post, Patch, Delete, Param, ParseIntPipe, UploadedFile, UseGuards, Query, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AccountingService } from './accounting.service';
import { CreateEntryDto, UpdateEntryDto, EntryFilterDto, UpdatePaymentStatusDto, VoidEntryDto, LockPeriodDto, PeriodCloseCheckDto, RecordPaymentDto } from './dto/entry.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../auth/guards/permission.guard';
import { RequirePermission } from '../auth/decorators/require-permission.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

const MAX_IMPORT_FILE_SIZE = 10 * 1024 * 1024;

@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('accounting')
export class AccountingController {
  constructor(private svc: AccountingService) {}

  @RequirePermission('accounting:create')
  @Post('revenue')
  createRevenue(@Body() dto: CreateEntryDto, @CurrentUser() user: { id: number; branchId?: number; roles?: string[] }) {
    return this.svc.createRevenue(dto, user.id, user);
  }

  @Get('revenue')
  findRevenue(@Query() filter: EntryFilterDto, @CurrentUser() user: { id: number; branchId?: number; roles?: string[] }) {
    return this.svc.findRevenue(filter, user);
  }

  @Get('revenue/chart')
  revenueChart(@Query() filter: EntryFilterDto, @CurrentUser() user: { id: number; branchId?: number; roles?: string[] }) {
    return this.svc.getRevenueChart(filter, user);
  }

  @Get('revenue/job/:jobId')
  revenueByJob(@Param('jobId', ParseIntPipe) jobId: number, @CurrentUser() user: { id: number; branchId?: number; roles?: string[] }) {
    return this.svc.findRevenueByJob(jobId, user);
  }

  @Get('revenue/:id')
  revenueDetail(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: { id: number; branchId?: number; roles?: string[] }) {
    return this.svc.findRevenueOne(id, user);
  }

  @RequirePermission('accounting:create')
  @Patch('revenue/:id')
  updateRevenue(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateEntryDto, @CurrentUser() user: { id: number; branchId?: number; roles?: string[] }) {
    return this.svc.updateRevenue(id, dto, user.id, user);
  }

  @RequirePermission('accounting:post')
  @Patch('revenue/:id/post')
  postRevenue(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: { id: number; branchId?: number; roles?: string[] }) {
    return this.svc.postRevenue(id, user.id, user);
  }

  @RequirePermission('accounting:post')
  @Post('revenue/:id/void')
  voidRevenue(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: VoidEntryDto,
    @CurrentUser() user: { id: number; branchId?: number; roles?: string[] },
  ) {
    return this.svc.voidRevenue(id, user.id, dto.reason, user);
  }

  @RequirePermission('accounting:post')
  @Patch('revenue/:id/payment-status')
  updateRevenuePayment(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdatePaymentStatusDto,
    @CurrentUser() user: { id: number; branchId?: number; roles?: string[] },
  ) {
    return this.svc.updateRevenuePaymentStatus(id, dto, user.id, user);
  }

  @RequirePermission('accounting:create')
  @Delete('revenue/:id')
  deleteRevenue(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: { id: number; branchId?: number; roles?: string[] }) {
    return this.svc.deleteRevenue(id, user.id, user);
  }

  @RequirePermission('accounting:create')
  @Post('cost')
  createCost(@Body() dto: CreateEntryDto, @CurrentUser() user: { id: number; branchId?: number; roles?: string[] }) {
    return this.svc.createCost(dto, user.id, user);
  }

  @RequirePermission('accounting:create')
  @Post('cost/import')
  @UseInterceptors(FileInterceptor('file'))
  importCost(@UploadedFile() file: Express.Multer.File, @CurrentUser() user: { id: number; branchId?: number; roles?: string[] }) {
    if (!file) throw new BadRequestException('No file uploaded');
    if (file.size > MAX_IMPORT_FILE_SIZE) throw new BadRequestException('File exceeds 10 MB limit');
    return this.svc.importCostEntries(file.buffer, user.id, user);
  }

  @Get('cost')
  findCost(@Query() filter: EntryFilterDto, @CurrentUser() user: { id: number; branchId?: number; roles?: string[] }) {
    return this.svc.findCost(filter, user);
  }

  @Get('cost/chart')
  costChart(@Query() filter: EntryFilterDto, @CurrentUser() user: { id: number; branchId?: number; roles?: string[] }) {
    return this.svc.getCostChart(filter, user);
  }

  @Get('cost/job/:jobId')
  costByJob(@Param('jobId', ParseIntPipe) jobId: number, @CurrentUser() user: { id: number; branchId?: number; roles?: string[] }) {
    return this.svc.findCostByJob(jobId, user);
  }

  @Get('cost/:id')
  costDetail(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: { id: number; branchId?: number; roles?: string[] }) {
    return this.svc.findCostOne(id, user);
  }

  @RequirePermission('accounting:create')
  @Patch('cost/:id')
  updateCost(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateEntryDto, @CurrentUser() user: { id: number; branchId?: number; roles?: string[] }) {
    return this.svc.updateCost(id, dto, user.id, user);
  }

  @RequirePermission('accounting:post')
  @Patch('cost/:id/post')
  postCost(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: { id: number; branchId?: number; roles?: string[] }) {
    return this.svc.postCost(id, user.id, user);
  }

  @RequirePermission('accounting:post')
  @Post('cost/:id/void')
  voidCost(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: VoidEntryDto,
    @CurrentUser() user: { id: number; branchId?: number; roles?: string[] },
  ) {
    return this.svc.voidCost(id, user.id, dto.reason, user);
  }

  @RequirePermission('accounting:post')
  @Patch('cost/:id/payment-status')
  updateCostPayment(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdatePaymentStatusDto,
    @CurrentUser() user: { id: number; branchId?: number; roles?: string[] },
  ) {
    return this.svc.updateCostPaymentStatus(id, dto, user.id, user);
  }

  @RequirePermission('accounting:create')
  @Delete('cost/:id')
  deleteCost(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: { id: number; branchId?: number; roles?: string[] }) {
    return this.svc.deleteCost(id, user.id, user);
  }

  @RequirePermission('accounting:post')
  @Post('post-all/job/:jobId')
  postAllForJob(@Param('jobId', ParseIntPipe) jobId: number, @CurrentUser() user: { id: number; branchId?: number; roles?: string[] }) {
    return this.svc.postAllForJob(jobId, user.id, user);
  }

  @Get('profit/job/:jobId')
  profitByJob(@Param('jobId', ParseIntPipe) jobId: number, @CurrentUser() user: { id: number; branchId?: number; roles?: string[] }) {
    return this.svc.getProfitSummary(jobId, user);
  }

  @RequirePermission('accounting:create')
  @Post('payments/receipts')
  recordReceipt(@Body() dto: RecordPaymentDto, @CurrentUser() user: { id: number; branchId?: number; roles?: string[] }) {
    return this.svc.recordRevenueReceipt(dto, user.id, user);
  }

  @RequirePermission('accounting:create')
  @Post('payments/vendor')
  recordVendorPayment(@Body() dto: RecordPaymentDto, @CurrentUser() user: { id: number; branchId?: number; roles?: string[] }) {
    return this.svc.recordVendorPayment(dto, user.id, user);
  }

  @RequirePermission('accounting:post')
  @Get('periods')
  getPeriods() {
    return this.svc.getPeriods();
  }

  @RequirePermission('accounting:post')
  @Get('periods/:year/:month/close-check')
  getPeriodCloseCheck(
    @Param() params: PeriodCloseCheckDto,
    @CurrentUser() user: { id: number; branchId?: number; roles?: string[] },
  ) {
    return this.svc.getPeriodCloseCheck(params.year, params.month, user);
  }

  @RequirePermission('accounting:post')
  @Post('periods/lock')
  lockPeriod(@Body() dto: LockPeriodDto, @CurrentUser() user: { id: number; branchId?: number; roles?: string[] }) {
    return this.svc.lockPeriod(dto, user.id, user);
  }

  @RequirePermission('accounting:post')
  @Post('periods/unlock')
  unlockPeriod(@Body() dto: LockPeriodDto, @CurrentUser() user: { id: number; branchId?: number; roles?: string[] }) {
    return this.svc.unlockPeriod(dto, user.id, user);
  }
}
