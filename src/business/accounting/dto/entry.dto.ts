import { IsNotEmpty, IsOptional, IsString, IsNumber, IsInt, Min } from 'class-validator';

export class CreateEntryDto {
  @IsInt() jobId: number;
  @IsOptional() @IsInt() vendorId?: number;
  @IsNotEmpty() @IsString() description: string;
  @IsOptional() @IsString() currency?: string;
  @IsNumber() @Min(0) amount: number;
  @IsOptional() @IsNumber() exchangeRate?: number;
  @IsNumber() @Min(0) localAmount: number;
  @IsOptional() @IsString() notes?: string;
}

export class UpdateEntryDto {
  @IsOptional() @IsInt() vendorId?: number;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() currency?: string;
  @IsOptional() @IsNumber() amount?: number;
  @IsOptional() @IsNumber() exchangeRate?: number;
  @IsOptional() @IsNumber() localAmount?: number;
  @IsOptional() @IsString() notes?: string;
}