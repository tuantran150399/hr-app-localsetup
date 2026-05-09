import { Type } from 'class-transformer';
import { IsBoolean, IsDateString, IsEnum, IsInt, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';
import { CashAccountType } from '../../../models/cash-account.entity';
import { CashTransactionType } from '../../../models/cash-transaction.entity';

export class CreateCashAccountDto {
  @IsString() code: string;
  @IsString() name: string;
  @IsEnum(CashAccountType) type: CashAccountType;
  @IsOptional() @IsString() currency?: string;
  @IsOptional() @IsString() bankName?: string;
  @IsOptional() @IsString() accountNumber?: string;
  @IsOptional() @Type(() => Number) @IsNumber() balance?: number;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class UpdateCashAccountDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsEnum(CashAccountType) type?: CashAccountType;
  @IsOptional() @IsString() currency?: string;
  @IsOptional() @IsString() bankName?: string;
  @IsOptional() @IsString() accountNumber?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class CashAccountFilterDto extends PaginationDto {
  @IsOptional() @IsEnum(CashAccountType) type?: CashAccountType;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class CreateCashTransactionDto {
  @Type(() => Number) @IsInt() cashAccountId: number;
  @IsEnum(CashTransactionType) transactionType: CashTransactionType;
  @IsDateString() transactionDate: string;
  @IsOptional() @IsString() currency?: string;
  @Type(() => Number) @IsNumber() @Min(0.01) amount: number;
  @IsString() description: string;
  @IsOptional() @Type(() => Number) @IsInt() jobId?: number;
  @IsOptional() @Type(() => Number) @IsInt() partnerId?: number;
  @IsOptional() @IsString() referenceType?: string;
  @IsOptional() @Type(() => Number) @IsInt() referenceId?: number;
  @IsOptional() @IsString() notes?: string;
}

export class CashTransactionFilterDto extends PaginationDto {
  @IsOptional() @Type(() => Number) @IsInt() cashAccountId?: number;
  @IsOptional() @IsEnum(CashTransactionType) transactionType?: CashTransactionType;
  @IsOptional() @IsDateString() dateFrom?: string;
  @IsOptional() @IsDateString() dateTo?: string;
}
