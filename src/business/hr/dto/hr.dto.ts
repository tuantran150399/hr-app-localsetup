import { Type } from 'class-transformer';
import { IsDateString, IsEmail, IsEnum, IsInt, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';
import { AttendanceStatus } from '../../../models/attendance-record.entity';
import { EmployeeStatus } from '../../../models/employee.entity';
import { LeaveStatus } from '../../../models/leave-request.entity';
import { PayrollStatus } from '../../../models/payroll-record.entity';

export class CreateEmployeeDto {
  @IsOptional() @Type(() => Number) @IsInt() userId?: number;
  @IsString() employeeCode: string;
  @IsString() fullName: string;
  @IsOptional() @Type(() => Number) @IsInt() branchId?: number;
  @IsOptional() @IsString() department?: string;
  @IsOptional() @IsString() position?: string;
  @IsOptional() @IsDateString() hireDate?: string;
  @IsOptional() @IsEnum(EmployeeStatus) status?: EmployeeStatus;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() address?: string;
}

export class UpdateEmployeeDto {
  @IsOptional() @Type(() => Number) @IsInt() userId?: number;
  @IsOptional() @IsString() fullName?: string;
  @IsOptional() @Type(() => Number) @IsInt() branchId?: number;
  @IsOptional() @IsString() department?: string;
  @IsOptional() @IsString() position?: string;
  @IsOptional() @IsDateString() hireDate?: string;
  @IsOptional() @IsEnum(EmployeeStatus) status?: EmployeeStatus;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() address?: string;
}

export class EmployeeFilterDto extends PaginationDto {
  @IsOptional() @Type(() => Number) @IsInt() branchId?: number;
  @IsOptional() @IsString() department?: string;
  @IsOptional() @IsEnum(EmployeeStatus) status?: EmployeeStatus;
}

export class UpsertAttendanceDto {
  @Type(() => Number) @IsInt() employeeId: number;
  @IsDateString() workDate: string;
  @IsOptional() @IsDateString() checkIn?: string;
  @IsOptional() @IsDateString() checkOut?: string;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) workHours?: number;
  @IsOptional() @IsEnum(AttendanceStatus) status?: AttendanceStatus;
  @IsOptional() @IsString() notes?: string;
}

export class AttendanceFilterDto extends PaginationDto {
  @IsOptional() @Type(() => Number) @IsInt() employeeId?: number;
  @IsOptional() @IsDateString() dateFrom?: string;
  @IsOptional() @IsDateString() dateTo?: string;
  @IsOptional() @IsEnum(AttendanceStatus) status?: AttendanceStatus;
}

export class CreateLeaveRequestDto {
  @Type(() => Number) @IsInt() employeeId: number;
  @IsString() leaveType: string;
  @IsDateString() dateFrom: string;
  @IsDateString() dateTo: string;
  @Type(() => Number) @IsNumber() @Min(0.5) days: number;
  @IsOptional() @IsString() reason?: string;
}

export class LeaveFilterDto extends PaginationDto {
  @IsOptional() @Type(() => Number) @IsInt() employeeId?: number;
  @IsOptional() @IsEnum(LeaveStatus) status?: LeaveStatus;
  @IsOptional() @IsDateString() dateFrom?: string;
  @IsOptional() @IsDateString() dateTo?: string;
}

export class RejectLeaveDto {
  @IsOptional() @IsString() reason?: string;
}

export class UpsertPayrollDto {
  @Type(() => Number) @IsInt() employeeId: number;
  @Type(() => Number) @IsInt() @Min(2000) year: number;
  @Type(() => Number) @IsInt() @Min(1) month: number;
  @Type(() => Number) @IsNumber() @Min(0) baseSalary: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) allowance?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) deduction?: number;
  @IsOptional() @IsString() notes?: string;
}

export class PayrollFilterDto extends PaginationDto {
  @IsOptional() @Type(() => Number) @IsInt() employeeId?: number;
  @IsOptional() @Type(() => Number) @IsInt() year?: number;
  @IsOptional() @Type(() => Number) @IsInt() month?: number;
  @IsOptional() @IsEnum(PayrollStatus) status?: PayrollStatus;
}
