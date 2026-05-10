import { IsOptional, IsNumber, IsString, IsArray, ValidateNested, IsEnum } from 'class-validator';
import { Type, Transform } from 'class-transformer';

export class CreateDebitNoteLineDto {
  @IsOptional() @IsString() serviceType?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsNumber() quantity?: number;
  @IsOptional() @IsNumber() unitPrice?: number;
  @IsOptional() @IsNumber() amount?: number;
  @IsOptional() @IsString() currency?: string;
  @IsOptional() @IsNumber() pricingId?: number;
}

export class CreateDebitNoteDto {
  @IsNumber() partnerId: number;
  @IsOptional() @IsNumber() jobId?: number;
  @IsOptional() @IsString() currency?: string;
  @IsOptional() @IsString() docDate?: string;
  @IsOptional() @IsString() dueDate?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsNumber() amount?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateDebitNoteLineDto)
  lineItems?: CreateDebitNoteLineDto[];
}

export class UpdateDebitNoteDto {
  @IsOptional() @IsNumber() partnerId?: number;
  @IsOptional() @IsNumber() jobId?: number;
  @IsOptional() @IsString() currency?: string;
  @IsOptional() @IsString() docDate?: string;
  @IsOptional() @IsString() dueDate?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsNumber() amount?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateDebitNoteLineDto)
  lineItems?: CreateDebitNoteLineDto[];
}

export class VoidDebitNoteDto {
  @IsString() reason: string;
}

export class DebitNoteFilterDto {
  @IsOptional() @Transform(({ value }) => parseInt(value)) page?: number;
  @IsOptional() @Transform(({ value }) => parseInt(value)) limit?: number;
  @IsOptional() @IsString() status?: string;
  @IsOptional() @Transform(({ value }) => parseInt(value)) partnerId?: number;
  @IsOptional() @Transform(({ value }) => parseInt(value)) jobId?: number;
}
