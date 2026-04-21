import { IsEnum, IsNotEmpty, IsOptional, IsString, IsDateString, IsInt, IsIn } from 'class-validator';
import { Type } from 'class-transformer';
import { JobType, ShipmentMode } from '../../../models/job.entity';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class CreateJobDto {
  @IsNotEmpty() @IsString() jobCode: string;
  @IsOptional() @IsEnum(JobType) jobType?: JobType;
  @IsOptional() @IsEnum(ShipmentMode) shipmentMode?: ShipmentMode;
  @IsOptional() @IsInt() partnerId?: number;
  @IsOptional() @IsInt() branchId?: number;
  @IsOptional() @IsInt() assignedUserId?: number;
  // Shipment details
  @IsOptional() @IsString() bookingRef?: string;
  @IsOptional() @IsString() vesselName?: string;
  @IsOptional() @IsString() voyageNo?: string;
  @IsOptional() @IsString() hbl?: string;
  @IsOptional() @IsString() mbl?: string;
  @IsOptional() @IsString() containerNo?: string;
  @IsOptional() @IsString() sealNo?: string;
  @IsOptional() @IsDateString() etd?: string;
  @IsOptional() @IsDateString() eta?: string;
  @IsOptional() @IsDateString() atd?: string;
  @IsOptional() @IsDateString() ata?: string;
  @IsOptional() @IsString() pol?: string;
  @IsOptional() @IsString() pod?: string;
  @IsOptional() @IsString() origin?: string;
  @IsOptional() @IsString() destination?: string;
  @IsOptional() @IsString() notes?: string;
  @IsOptional() @IsString() internalNotes?: string;
}

export class UpdateJobDto {
  @IsOptional() @IsEnum(JobType) jobType?: JobType;
  @IsOptional() @IsEnum(ShipmentMode) shipmentMode?: ShipmentMode;
  @IsOptional() @IsInt() partnerId?: number;
  @IsOptional() @IsInt() branchId?: number;
  @IsOptional() @IsInt() assignedUserId?: number;
  @IsOptional() @IsString() bookingRef?: string;
  @IsOptional() @IsString() vesselName?: string;
  @IsOptional() @IsString() voyageNo?: string;
  @IsOptional() @IsString() hbl?: string;
  @IsOptional() @IsString() mbl?: string;
  @IsOptional() @IsString() containerNo?: string;
  @IsOptional() @IsString() sealNo?: string;
  @IsOptional() @IsDateString() etd?: string;
  @IsOptional() @IsDateString() eta?: string;
  @IsOptional() @IsDateString() atd?: string;
  @IsOptional() @IsDateString() ata?: string;
  @IsOptional() @IsString() pol?: string;
  @IsOptional() @IsString() pod?: string;
  @IsOptional() @IsString() origin?: string;
  @IsOptional() @IsString() destination?: string;
  @IsOptional() @IsString() notes?: string;
  @IsOptional() @IsString() internalNotes?: string;
}

/** Query DTO for GET /jobs — pagination + filters */
export class JobFilterDto extends PaginationDto {
  @IsOptional() @IsEnum(JobType) jobType?: JobType;
  @IsOptional() @IsEnum(ShipmentMode) shipmentMode?: ShipmentMode;
  @IsOptional() @IsString() status?: string;
  @IsOptional() @Type(() => Number) @IsInt() branchId?: number;
  @IsOptional() @Type(() => Number) @IsInt() partnerId?: number;
  @IsOptional() @Type(() => Number) @IsInt() assignedUserId?: number;
  @IsOptional() @IsDateString() dateFrom?: string;
  @IsOptional() @IsDateString() dateTo?: string;
  /** Allowed sort fields */
  @IsOptional() @IsString() @IsIn(['createdAt', 'etd', 'eta', 'jobCode', 'status']) sortBy?: string;
}

export class CreateMilestoneDto {
  @IsNotEmpty() @IsString() title: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsDateString() milestoneAt?: string;
  @IsOptional() @Type(() => Number) @IsInt() sortOrder?: number;
}

export class UpdateMilestoneDto {
  @IsOptional() @IsString() title?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsDateString() milestoneAt?: string;
  @IsOptional() @Type(() => Number) @IsInt() sortOrder?: number;
}