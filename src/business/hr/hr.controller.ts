import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { HrService } from './hr.service';
import {
  AttendanceFilterDto,
  CreateEmployeeDto,
  CreateLeaveRequestDto,
  EmployeeFilterDto,
  LeaveFilterDto,
  PayrollFilterDto,
  RejectLeaveDto,
  UpdateEmployeeDto,
  UpsertAttendanceDto,
  UpsertPayrollDto,
} from './dto/hr.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../auth/guards/permission.guard';
import { RequirePermission } from '../auth/decorators/require-permission.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('hr')
export class HrController {
  constructor(private svc: HrService) {}

  @RequirePermission('hr:manage')
  @Post('employees')
  createEmployee(@Body() dto: CreateEmployeeDto, @CurrentUser() user: { id: number }) {
    return this.svc.createEmployee(dto, user.id);
  }

  @RequirePermission('hr:view')
  @Get('employees')
  findEmployees(@Query() filter: EmployeeFilterDto) {
    return this.svc.findEmployees(filter);
  }

  @RequirePermission('hr:view')
  @Get('employees/:id')
  findEmployee(@Param('id', ParseIntPipe) id: number) {
    return this.svc.findEmployee(id);
  }

  @RequirePermission('hr:manage')
  @Patch('employees/:id')
  updateEmployee(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateEmployeeDto, @CurrentUser() user: { id: number }) {
    return this.svc.updateEmployee(id, dto, user.id);
  }

  @RequirePermission('hr:manage')
  @Delete('employees/:id')
  deactivateEmployee(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: { id: number }) {
    return this.svc.deactivateEmployee(id, user.id);
  }

  @RequirePermission('hr:manage')
  @Post('attendance')
  upsertAttendance(@Body() dto: UpsertAttendanceDto, @CurrentUser() user: { id: number }) {
    return this.svc.upsertAttendance(dto, user.id);
  }

  @RequirePermission('hr:view')
  @Get('attendance')
  findAttendance(@Query() filter: AttendanceFilterDto) {
    return this.svc.findAttendance(filter);
  }

  @RequirePermission('hr:manage')
  @Post('leave-requests')
  createLeave(@Body() dto: CreateLeaveRequestDto, @CurrentUser() user: { id: number }) {
    return this.svc.createLeave(dto, user.id);
  }

  @RequirePermission('hr:view')
  @Get('leave-requests')
  findLeaves(@Query() filter: LeaveFilterDto) {
    return this.svc.findLeaves(filter);
  }

  @RequirePermission('hr:manage')
  @Patch('leave-requests/:id/approve')
  approveLeave(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: { id: number }) {
    return this.svc.approveLeave(id, user.id);
  }

  @RequirePermission('hr:manage')
  @Patch('leave-requests/:id/reject')
  rejectLeave(@Param('id', ParseIntPipe) id: number, @Body() dto: RejectLeaveDto, @CurrentUser() user: { id: number }) {
    return this.svc.rejectLeave(id, dto, user.id);
  }

  @RequirePermission('hr:manage')
  @Post('payroll')
  upsertPayroll(@Body() dto: UpsertPayrollDto, @CurrentUser() user: { id: number }) {
    return this.svc.upsertPayroll(dto, user.id);
  }

  @RequirePermission('hr:view')
  @Get('payroll')
  findPayroll(@Query() filter: PayrollFilterDto) {
    return this.svc.findPayroll(filter);
  }

  @RequirePermission('hr:manage')
  @Patch('payroll/:id/post')
  postPayroll(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: { id: number }) {
    return this.svc.postPayroll(id, user.id);
  }
}
