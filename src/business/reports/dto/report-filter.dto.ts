import { IsIn, IsOptional, IsDateString, IsInt } from 'class-validator';
import { Type } from 'class-transformer';

export class ReportFilterDto {
  @IsOptional() @IsDateString() dateFrom?: string;
  @IsOptional() @IsDateString() dateTo?: string;
  @IsOptional() @Type(() => Number) @IsInt() branchId?: number;
  @IsOptional() @Type(() => Number) @IsInt() partnerId?: number;
  @IsOptional() @IsIn(['month', 'quarter', 'year', 'job', 'customer']) groupBy?: 'month' | 'quarter' | 'year' | 'job' | 'customer';
}
