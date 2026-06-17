import { Type } from 'class-transformer';
import { IsBoolean, IsDateString, IsInt, IsNumber, IsOptional, Min } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class UpsertDebtPolicyDto {
  @Type(() => Number)
  @IsInt()
  partnerId: number;

  @IsDateString()
  startDate: string;

  @IsOptional()
  @IsDateString()
  endDate?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maxDebtAmount?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  maxDebtAgeDays?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class DebtPolicyFilterDto extends PaginationDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  partnerId?: number;
}
