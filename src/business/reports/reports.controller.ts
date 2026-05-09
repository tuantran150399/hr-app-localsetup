import { Controller, Get, Param, ParseIntPipe, Query, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { ReportsService } from './reports.service';
import { ReportFilterDto } from './dto/report-filter.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../auth/guards/permission.guard';
import { RequirePermission } from '../auth/decorators/require-permission.decorator';

@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('reports')
export class ReportsController {
  constructor(private svc: ReportsService) {}

  /** Profit summary for a single job */
  @RequirePermission('accounting:view')
  @Get('profit/job/:jobId')
  profitByJob(@Param('jobId', ParseIntPipe) jobId: number) {
    return this.svc.profitByJob(jobId);
  }

  /** Revenue / cost / profit grouped by branch */
  @RequirePermission('accounting:view')
  @Get('branch-summary')
  branchSummary(@Query() filter: ReportFilterDto) {
    return this.svc.revenueByBranch(filter);
  }

  /** Revenue / cost / profit grouped by customer (partner) */
  @RequirePermission('accounting:view')
  @Get('customer-summary')
  customerSummary(@Query() filter: ReportFilterDto) {
    return this.svc.revenueByCustomer(filter);
  }

  @RequirePermission('accounting:view')
  @Get('pnl')
  pnl(@Query() filter: ReportFilterDto) {
    return this.svc.pnlByPeriod(filter);
  }

  @RequirePermission('accounting:view')
  @Get('cash-flow')
  cashFlow(@Query() filter: ReportFilterDto) {
    return this.svc.cashFlow(filter);
  }

  @RequirePermission('accounting:view')
  @Get(':reportKey/export')
  async exportReport(
    @Param('reportKey') reportKey: string,
    @Query() filter: ReportFilterDto,
    @Res() res: Response,
  ) {
    const exported = await this.svc.exportReport(reportKey, filter);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${exported.fileName}"`);
    res.send(exported.buffer);
  }

  /** Open vs closed job counts by status */
  @RequirePermission('accounting:view')
  @Get('job-status-summary')
  jobStatusSummary(@Query() filter: ReportFilterDto) {
    return this.svc.jobStatusSummary(filter);
  }

  /** Outstanding receivables (revenue entries not yet fully paid) */
  @RequirePermission('accounting:view')
  @Get('receivables')
  receivables(@Query() filter: ReportFilterDto) {
    return this.svc.receivableSummary(filter);
  }

  /** Outstanding payables (cost entries not yet fully paid) */
  @RequirePermission('accounting:view')
  @Get('payables')
  payables(@Query() filter: ReportFilterDto) {
    return this.svc.payableSummary(filter);
  }

  /** Overdue receivables (past due date, not paid) */
  @RequirePermission('accounting:view')
  @Get('overdue-receivables')
  overdueReceivables(@Query() filter: ReportFilterDto) {
    return this.svc.overdueReceivables(filter);
  }

  /** Overdue payables (past due date, not paid) */
  @RequirePermission('accounting:view')
  @Get('overdue-payables')
  overduePayables(@Query() filter: ReportFilterDto) {
    return this.svc.overduePayables(filter);
  }
}
