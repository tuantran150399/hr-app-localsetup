import { Type } from 'class-transformer';
import { IsBoolean, IsDateString, IsEnum, IsInt, IsNumber, IsOptional, IsString, Min, ValidateIf } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';
import { PaymentRequestStatus } from '../../../models/payment-request.entity';

export class CreatePaymentRequestDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  branchId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  jobId?: number;

  @Type(() => Number)
  @IsInt()
  vendorId: number;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isChargeOnBehalf?: boolean;

  @ValidateIf((dto) => dto.isChargeOnBehalf)
  @Type(() => Number)
  @IsInt()
  chargeToPartnerId?: number;

  @IsOptional()
  @IsString()
  currency?: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  amount: number;

  @IsOptional()
  @IsDateString()
  requestedPaymentDate?: string;

  @IsOptional()
  @IsString()
  reason?: string;
}

export class RejectPaymentRequestDto {
  @IsString()
  reason: string;
}

export class PaymentRequestFilterDto extends PaginationDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  branchId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  jobId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  vendorId?: number;

  @IsOptional()
  @IsEnum(PaymentRequestStatus)
  status?: PaymentRequestStatus;
}
