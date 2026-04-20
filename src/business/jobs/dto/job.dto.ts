import { IsEnum, IsNotEmpty, IsOptional, IsString, IsDateString, IsInt } from 'class-validator';
import { JobType, ShipmentMode } from '../../../models/job.entity';

export class CreateJobDto {
  @IsNotEmpty() @IsString() jobCode: string;
  @IsOptional() @IsEnum(JobType) jobType?: JobType;
  @IsOptional() @IsEnum(ShipmentMode) shipmentMode?: ShipmentMode;
  @IsOptional() @IsInt() partnerId?: number;
  @IsOptional() @IsInt() branchId?: number;
  @IsOptional() @IsInt() assignedUserId?: number;
  @IsOptional() @IsDateString() etd?: string;
  @IsOptional() @IsDateString() eta?: string;
  @IsOptional() @IsString() origin?: string;
  @IsOptional() @IsString() destination?: string;
  @IsOptional() @IsString() notes?: string;
}

export class UpdateJobDto {
  @IsOptional() @IsEnum(JobType) jobType?: JobType;
  @IsOptional() @IsEnum(ShipmentMode) shipmentMode?: ShipmentMode;
  @IsOptional() @IsInt() partnerId?: number;
  @IsOptional() @IsInt() branchId?: number;
  @IsOptional() @IsInt() assignedUserId?: number;
  @IsOptional() @IsDateString() etd?: string;
  @IsOptional() @IsDateString() eta?: string;
  @IsOptional() @IsString() origin?: string;
  @IsOptional() @IsString() destination?: string;
  @IsOptional() @IsString() notes?: string;
}