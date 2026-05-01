import { IsNotEmpty, IsOptional, IsString, IsNumber, IsInt, Min, IsEnum, IsDateString, IsIn } from 'class-validator';
import { Type } from 'class-transformer';
import { PaymentStatus } from '../../../models/revenue-entry.entity';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class CreateEntryDto {
  @IsInt() jobId: number;
  @IsOptional() @IsInt() vendorId?: number;
  @IsNotEmpty() @IsString() description: string;
  @IsOptional() @IsString() currency?: string;
  @IsNumber() @Min(0) amount: number;
  @IsOptional() @IsNumber() exchangeRate?: number;
  @IsNumber() @Min(0) localAmount: number;
  // Payment tracking
  @IsOptional() @IsString() refNumber?: string;
  @IsOptional() @IsString() invoiceNumber?: string;
  @IsOptional() @IsDateString() docDate?: string;
  @IsOptional() @IsDateString() dueDate?: string;
  @IsOptional() @IsString() notes?: string;
}

export class UpdateEntryDto {
  @IsOptional() @IsInt() vendorId?: number;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() currency?: string;
  @IsOptional() @IsNumber() amount?: number;
  @IsOptional() @IsNumber() exchangeRate?: number;
  @IsOptional() @IsNumber() localAmount?: number;
  @IsOptional() @IsString() refNumber?: string;
  @IsOptional() @IsString() invoiceNumber?: string;
  @IsOptional() @IsDateString() docDate?: string;
  @IsOptional() @IsDateString() dueDate?: string;
  @IsOptional() @IsString() notes?: string;
}

export class UpdatePaymentStatusDto {
  @IsEnum(PaymentStatus) paymentStatus: PaymentStatus;
}

export class VoidEntryDto {
  @IsOptional() @IsString() reason?: string;
}

/** Query DTO for listing revenue/cost entries with pagination */
export class EntryFilterDto extends PaginationDto {
  @IsOptional() @Type(() => Number) @IsInt() jobId?: number;
  @IsOptional() @Type(() => Number) @IsInt() vendorId?: number;
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsEnum(PaymentStatus) paymentStatus?: PaymentStatus;
  @IsOptional() @IsDateString() dateFrom?: string;
  @IsOptional() @IsDateString() dateTo?: string;
  @IsOptional() @IsString() @IsIn(['createdAt', 'docDate', 'dueDate', 'localAmount']) sortBy?: string;
}

export class LockPeriodDto {
  @IsInt() @Min(2000) year: number;
  @IsInt() @Min(1) month: number;
}

export class RecordPaymentDto {
  @Type(() => Number)
  @IsInt()
  entryId: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  amount: number;

  @IsOptional()
  @IsDateString()
  paymentDate?: string;

  @IsOptional()
  @IsString()
  method?: string;

  @IsOptional()
  @IsString()
  accountRef?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
