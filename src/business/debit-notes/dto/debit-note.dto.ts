import { IsOptional, IsNumber, IsString, IsArray, ValidateNested, IsEnum } from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { PaymentMethod } from '../../../models/revenue-entry.entity';

export class CreateDebitNoteLineDto {
  @IsOptional() @IsNumber() jobId?: number;
  @IsOptional() @IsString() serviceType?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() chargeNote?: string;
  @IsOptional() @IsString() lineNote?: string;
  @IsOptional() @IsNumber() quantity?: number;
  @IsOptional() @IsNumber() unitPrice?: number;
  @IsOptional() @IsNumber() amount?: number;
  @IsOptional() @IsNumber() creditAmount?: number;
  @IsOptional() @IsNumber() vatRate?: number;
  @IsOptional() @IsNumber() vatAmount?: number;
  @IsOptional() @IsString() currency?: string;
  @IsOptional() @IsNumber() pricingId?: number;
}

export class CreateDebitNoteDto {
  @IsOptional() @IsNumber() partnerId?: number;
  @IsOptional() @IsNumber() jobId?: number;
  @IsOptional() @IsArray() @IsNumber({}, { each: true }) jobIds?: number[];
  @IsOptional() @IsString() currency?: string;
  @IsOptional() @IsString() docDate?: string;
  @IsOptional() @IsString() dueDate?: string;
  @IsOptional() @IsString() referenceNo?: string;
  @IsOptional() @IsString() groupCode?: string;
  @IsOptional() @IsString() paymentTerm?: string;
  @IsOptional() @IsString() movingType?: string;
  @IsOptional() @IsString() direction?: string;
  @IsOptional() @IsString() mblNo?: string;
  @IsOptional() @IsString() exportNote?: string;
  @IsOptional() @IsString() bankName?: string;
  @IsOptional() @IsString() bankAccountNo?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsNumber() amount?: number;
  @IsOptional() @IsEnum(PaymentMethod) paymentMethod?: PaymentMethod;
  @IsOptional() @IsString() paymentAccountRef?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateDebitNoteLineDto)
  lineItems?: CreateDebitNoteLineDto[];
}

export class UpdateDebitNoteDto {
  @IsOptional() @IsNumber() partnerId?: number;
  @IsOptional() @IsNumber() jobId?: number;
  @IsOptional() @IsArray() @IsNumber({}, { each: true }) jobIds?: number[];
  @IsOptional() @IsString() currency?: string;
  @IsOptional() @IsString() docDate?: string;
  @IsOptional() @IsString() dueDate?: string;
  @IsOptional() @IsString() referenceNo?: string;
  @IsOptional() @IsString() groupCode?: string;
  @IsOptional() @IsString() paymentTerm?: string;
  @IsOptional() @IsString() movingType?: string;
  @IsOptional() @IsString() direction?: string;
  @IsOptional() @IsString() mblNo?: string;
  @IsOptional() @IsString() exportNote?: string;
  @IsOptional() @IsString() bankName?: string;
  @IsOptional() @IsString() bankAccountNo?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsNumber() amount?: number;
  @IsOptional() @IsEnum(PaymentMethod) paymentMethod?: PaymentMethod;
  @IsOptional() @IsString() paymentAccountRef?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateDebitNoteLineDto)
  lineItems?: CreateDebitNoteLineDto[];
}

export class VoidDebitNoteDto {
  @IsString() reason: string;
}

export class RecordDebitNotePaymentDto {
  @IsNumber() amount: number;
  @IsEnum(PaymentMethod) paymentMethod: PaymentMethod;
  @IsOptional() @IsString() paymentAccountRef?: string;
  @IsOptional() @IsString() paymentDate?: string;
}

export class DebitNoteFilterDto {
  @IsOptional() @Transform(({ value }) => parseInt(value)) page?: number;
  @IsOptional() @Transform(({ value }) => parseInt(value)) limit?: number;
  @IsOptional() @IsString() status?: string;
  @IsOptional() @Transform(({ value }) => parseInt(value)) partnerId?: number;
  @IsOptional() @Transform(({ value }) => parseInt(value)) jobId?: number;
  @IsOptional() @Transform(({ value }) => parseInt(value)) branchId?: number;
}
