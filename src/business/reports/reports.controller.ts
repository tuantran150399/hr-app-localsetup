import { Controller, Get, Param, ParseIntPipe, Query, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { ReportsService } from './reports.service';
import { ReportFilterDto } from './dto/report-filter.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../auth/guards/permission.guard';
import { RequirePermission } from '../auth/decorators/require-permission.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('reports')
export class ReportsController {
  constructor(private svc: ReportsService) {}

  /** Profit summary for a single job */
  @RequirePermission('accounting:view')
  @Get('profit/job/:jobId')
  profitByJob(@Param('jobId', ParseIntPipe) jobId: number, @CurrentUser() user: { id: number; branchId?: number; roles?: string[] }) {
    return this.svc.profitByJob(jobId, user);
  }

  /** Revenue / cost / profit grouped by branch */
  @RequirePermission('accounting:view')
  @Get('branch-summary')
  branchSummary(@Query() filter: ReportFilterDto, @CurrentUser() user: { id: number; branchId?: number; roles?: string[] }) {
    return this.svc.revenueByBranch(filter, user);
  }

  /** Revenue / cost / profit grouped by customer (partner) */
  @RequirePermission('accounting:view')
  @Get('customer-summary')
  customerSummary(@Query() filter: ReportFilterDto, @CurrentUser() user: { id: number; branchId?: number; roles?: string[] }) {
    return this.svc.revenueByCustomer(filter, user);
  }

  @RequirePermission('accounting:view')
  @Get('pnl')
  pnl(@Query() filter: ReportFilterDto, @CurrentUser() user: { id: number; branchId?: number; roles?: string[] }) {
    return this.svc.pnlByPeriod(filter, user);
  }

  @RequirePermission('accounting:view')
  @Get('cash-flow')
  cashFlow(@Query() filter: ReportFilterDto, @CurrentUser() user: { id: number; branchId?: number; roles?: string[] }) {
    return this.svc.cashFlow(filter, user);
  }

  @RequirePermission('accounting:view')
  @Get(':reportKey/export')
  async exportReport(
    @Param('reportKey') reportKey: string,
    @Query() filter: ReportFilterDto,
    @CurrentUser() user: { id: number; branchId?: number; roles?: string[] },
    @Res() res: Response,
  ) {
    const exported = await this.svc.exportReport(reportKey, filter, user);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${exported.fileName}"`);
    res.send(exported.buffer);
  }

  /** Open vs closed job counts by status */
  @RequirePermission('accounting:view')
  @Get('job-status-summary')
  jobStatusSummary(@Query() filter: ReportFilterDto, @CurrentUser() user: { id: number; branchId?: number; roles?: string[] }) {
    return this.svc.jobStatusSummary(filter, user);
  }

  /** Outstanding receivables (revenue entries not yet fully paid) */
  @RequirePermission('accounting:view')
  @Get('receivables')
  receivables(@Query() filter: ReportFilterDto, @CurrentUser() user: { id: number; branchId?: number; roles?: string[] }) {
    return this.svc.receivableSummary(filter, user);
  }

  /** Outstanding payables (cost entries not yet fully paid) */
  @RequirePermission('accounting:view')
  @Get('payables')
  payables(@Query() filter: ReportFilterDto, @CurrentUser() user: { id: number; branchId?: number; roles?: string[] }) {
    return this.svc.payableSummary(filter, user);
  }

  /** Overdue receivables (past due date, not paid) */
  @RequirePermission('accounting:view')
  @Get('overdue-receivables')
  overdueReceivables(@Query() filter: ReportFilterDto, @CurrentUser() user: { id: number; branchId?: number; roles?: string[] }) {
    return this.svc.overdueReceivables(filter, user);
  }

  /** Overdue payables (past due date, not paid) */
  @RequirePermission('accounting:view')
  @Get('overdue-payables')
  overduePayables(@Query() filter: ReportFilterDto, @CurrentUser() user: { id: number; branchId?: number; roles?: string[] }) {
    return this.svc.overduePayables(filter, user);
  }
}
