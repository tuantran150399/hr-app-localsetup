import { Type } from 'class-transformer';
import { IsBoolean, IsDateString, IsEnum, IsInt, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';
import { PricingServiceType } from '../../../models/service-price.entity';

export class CreateServicePriceDto {
  @IsOptional() @Type(() => Number) @IsInt() partnerId?: number;
  @IsEnum(PricingServiceType) serviceType: PricingServiceType;
  @IsOptional() @IsString() shipmentMode?: string;
  @IsOptional() @IsString() routeFrom?: string;
  @IsOptional() @IsString() routeTo?: string;
  @IsOptional() @IsString() unit?: string;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) minQuantity?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) maxQuantity?: number;
  @IsOptional() @IsString() currency?: string;
  @Type(() => Number) @IsNumber() @Min(0) amount: number;
  @IsOptional() @IsDateString() effectiveFrom?: string;
  @IsOptional() @IsDateString() effectiveTo?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsString() notes?: string;
}

export class UpdateServicePriceDto {
  @IsOptional() @Type(() => Number) @IsInt() partnerId?: number;
  @IsOptional() @IsEnum(PricingServiceType) serviceType?: PricingServiceType;
  @IsOptional() @IsString() shipmentMode?: string;
  @IsOptional() @IsString() routeFrom?: string;
  @IsOptional() @IsString() routeTo?: string;
  @IsOptional() @IsString() unit?: string;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) minQuantity?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) maxQuantity?: number;
  @IsOptional() @IsString() currency?: string;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) amount?: number;
  @IsOptional() @IsDateString() effectiveFrom?: string;
  @IsOptional() @IsDateString() effectiveTo?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsString() notes?: string;
}

export class ServicePriceFilterDto extends PaginationDto {
  @IsOptional() @Type(() => Number) @IsInt() partnerId?: number;
  @IsOptional() @IsEnum(PricingServiceType) serviceType?: PricingServiceType;
  @IsOptional() @IsString() shipmentMode?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class PriceSuggestionDto {
  @IsOptional() @Type(() => Number) @IsInt() partnerId?: number;
  @IsEnum(PricingServiceType) serviceType: PricingServiceType;
  @IsOptional() @IsString() shipmentMode?: string;
  @IsOptional() @IsString() routeFrom?: string;
  @IsOptional() @IsString() routeTo?: string;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) quantity?: number;
  @IsOptional() @IsDateString() serviceDate?: string;
}
