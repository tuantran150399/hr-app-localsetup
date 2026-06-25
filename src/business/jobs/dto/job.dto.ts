import { Type } from 'class-transformer';
import { IsBoolean, IsDateString, IsEnum, IsIn, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { JobStatus, JobType, ShipmentMode } from '../../../models/job.entity';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class CreateJobDto {
  @IsNotEmpty() @IsString() jobCode: string;
  @IsOptional() @IsEnum(JobType) jobType?: JobType;
  @IsOptional() @IsEnum(ShipmentMode) shipmentMode?: ShipmentMode;
  @IsOptional() @IsInt() partnerId?: number;
  @IsOptional() @IsInt() branchId?: number;
  @IsOptional() @IsInt() assignedUserId?: number;
  @IsOptional() @IsInt() agentId?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) debtAmount?: number | null;
  @IsOptional() @IsString() shipper?: string;
  @IsOptional() @IsString() consignee?: string;
  @IsOptional() @IsString() declarationNo?: string;
  @IsOptional() @IsString() businessType?: string;
  @IsOptional() @IsString() customsLane?: string;
  @IsOptional() @IsString() cargoType?: string;
  @IsOptional() @IsString() bookingRef?: string;
  @IsOptional() @IsString() vesselName?: string;
  @IsOptional() @IsString() voyageNo?: string;
  @IsOptional() @IsString() hbl?: string;
  @IsOptional() @IsString() mbl?: string;
  @IsOptional() @IsString() containerNo?: string;
  @IsOptional() @IsString() cargoUnit?: string;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) cargoQuantity?: number | null;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) weightKg?: number | null;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) volumeCbm?: number | null;
  @IsOptional() @IsString() sealNo?: string;
  @IsOptional() @IsDateString() etd?: string;
  @IsOptional() @IsDateString() eta?: string;
  @IsOptional() @IsDateString() atd?: string;
  @IsOptional() @IsDateString() ata?: string;
  @IsOptional() @IsDateString() actualDeliveryDate?: string;
  @IsOptional() @IsString() pol?: string;
  @IsOptional() @IsString() pod?: string;
  @IsOptional() @IsString() origin?: string;
  @IsOptional() @IsString() destination?: string;
  @IsOptional() @IsString() notes?: string;
  @IsOptional() @IsString() internalNotes?: string;
  @IsOptional() @IsBoolean() confirmDebitNoteLock?: boolean;
}

export class UpdateJobDto {
  @IsOptional() @IsEnum(JobType) jobType?: JobType;
  @IsOptional() @IsEnum(ShipmentMode) shipmentMode?: ShipmentMode;
  @IsOptional() @IsEnum(JobStatus) status?: JobStatus;
  @IsOptional() @IsInt() partnerId?: number;
  @IsOptional() @IsInt() branchId?: number;
  @IsOptional() @IsInt() assignedUserId?: number;
  @IsOptional() @IsInt() agentId?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) debtAmount?: number | null;
  @IsOptional() @IsString() shipper?: string;
  @IsOptional() @IsString() consignee?: string;
  @IsOptional() @IsString() declarationNo?: string;
  @IsOptional() @IsString() businessType?: string;
  @IsOptional() @IsString() customsLane?: string;
  @IsOptional() @IsString() cargoType?: string;
  @IsOptional() @IsString() bookingRef?: string;
  @IsOptional() @IsString() vesselName?: string;
  @IsOptional() @IsString() voyageNo?: string;
  @IsOptional() @IsString() hbl?: string;
  @IsOptional() @IsString() mbl?: string;
  @IsOptional() @IsString() containerNo?: string;
  @IsOptional() @IsString() cargoUnit?: string;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) cargoQuantity?: number | null;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) weightKg?: number | null;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) volumeCbm?: number | null;
  @IsOptional() @IsString() sealNo?: string;
  @IsOptional() @IsDateString() etd?: string;
  @IsOptional() @IsDateString() eta?: string;
  @IsOptional() @IsDateString() atd?: string;
  @IsOptional() @IsDateString() ata?: string;
  @IsOptional() @IsDateString() actualDeliveryDate?: string;
  @IsOptional() @IsString() pol?: string;
  @IsOptional() @IsString() pod?: string;
  @IsOptional() @IsString() origin?: string;
  @IsOptional() @IsString() destination?: string;
  @IsOptional() @IsString() notes?: string;
  @IsOptional() @IsString() internalNotes?: string;
  @IsOptional() @IsBoolean() confirmDebitNoteLock?: boolean;
}

export class JobFilterDto extends PaginationDto {
  @IsOptional() @IsEnum(JobType) jobType?: JobType;
  @IsOptional() @IsEnum(ShipmentMode) shipmentMode?: ShipmentMode;
  @IsOptional() @IsString() status?: string;
  @IsOptional() @Type(() => Number) @IsInt() branchId?: number;
  @IsOptional() @Type(() => Number) @IsInt() partnerId?: number;
  @IsOptional() @Type(() => Number) @IsInt() assignedUserId?: number;
  @IsOptional() @IsDateString() dateFrom?: string;
  @IsOptional() @IsDateString() dateTo?: string;
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

export class JobDebtPreviewDto {
  @IsOptional() @Type(() => Number) @IsInt() partnerId?: number;
  @IsOptional() @Type(() => Number) @IsInt() jobId?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) debtAmount?: number | null;
}
