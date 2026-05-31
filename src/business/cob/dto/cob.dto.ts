import { IsEnum, IsOptional, IsNumber, IsString } from 'class-validator';
import { Transform } from 'class-transformer';
import { PaymentMethod } from '../../../models/revenue-entry.entity';

export class CreateCobDto {
  @IsNumber() partnerId: number;
  @IsOptional() @IsNumber() vendorId?: number;
  @IsOptional() @IsNumber() jobId?: number;
  @IsNumber() amount: number;
  @IsOptional() @IsString() currency?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsEnum(PaymentMethod) paymentMethod?: PaymentMethod;
}

export class MarkCostAsCobDto {
  @IsNumber() partnerId: number;
}

export class CobFilterDto {
  @IsOptional() @Transform(({ value }) => parseInt(value)) page?: number;
  @IsOptional() @Transform(({ value }) => parseInt(value)) limit?: number;
  @IsOptional() @IsString() type?: string;
  @IsOptional() @IsString() status?: string;
}
