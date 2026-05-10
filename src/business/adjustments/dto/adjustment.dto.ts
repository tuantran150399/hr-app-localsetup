import { IsOptional, IsNumber, IsString, IsEnum } from 'class-validator';
import { Transform } from 'class-transformer';
import { AdjustmentType } from '../../../models/adjustment-entry.entity';

export class CreateAdjustmentDto {
  @IsOptional() @IsNumber() jobId?: number;
  @IsEnum(AdjustmentType) type: AdjustmentType;
  @IsOptional() @IsNumber() originalEntryId?: number;
  @IsOptional() @IsString() originalEntryType?: string;
  @IsString() description: string;
  @IsString() currency: string;
  @IsNumber() amount: number;
  @IsOptional() @IsNumber() exchangeRate?: number;
  @IsOptional() @IsNumber() localAmount?: number;
  @IsOptional() @IsString() docDate?: string;
  @IsOptional() @IsString() notes?: string;
}

export class AdjustmentFilterDto {
  @IsOptional() @Transform(({ value }) => parseInt(value)) page?: number;
  @IsOptional() @Transform(({ value }) => parseInt(value)) limit?: number;
  @IsOptional() @IsString() type?: string;
  @IsOptional() @Transform(({ value }) => parseInt(value)) jobId?: number;
}
