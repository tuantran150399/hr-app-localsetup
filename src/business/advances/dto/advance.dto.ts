import { Type } from 'class-transformer';
import { IsDateString, IsEnum, IsInt, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';
import { AdvanceStatus } from '../../../models/employee-advance.entity';
import { PaymentMethod } from '../../../models/revenue-entry.entity';

export class CreateAdvanceDto {
  @Type(() => Number) @IsInt() employeeId: number;
  @IsOptional() @Type(() => Number) @IsInt() jobId?: number;
  @IsOptional() @IsString() currency?: string;
  @Type(() => Number) @IsNumber() @Min(0.01) amount: number;
  @IsOptional() @IsDateString() dueDate?: string;
  @IsOptional() @IsString() purpose?: string;
  @IsOptional() @IsEnum(PaymentMethod) paymentMethod?: PaymentMethod;
}

export class AdvanceFilterDto extends PaginationDto {
  @IsOptional() @Type(() => Number) @IsInt() employeeId?: number;
  @IsOptional() @Type(() => Number) @IsInt() jobId?: number;
  @IsOptional() @IsEnum(AdvanceStatus) status?: AdvanceStatus;
  @IsOptional() @IsDateString() dueDateFrom?: string;
  @IsOptional() @IsDateString() dueDateTo?: string;
}

export class RejectAdvanceDto {
  @IsOptional() @IsString() reason?: string;
}

export class SettleAdvanceDto {
  @Type(() => Number) @IsNumber() @Min(0.01) amount: number;
}
