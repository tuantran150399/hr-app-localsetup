import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { PartnerType } from '../../../models/partner.entity';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class CreatePartnerDto {
  @IsNotEmpty() @IsString() code: string;
  @IsNotEmpty() @IsString() name: string;
  @IsEnum(PartnerType) partnerType: PartnerType;
  @IsOptional() @IsString() contactPerson?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() email?: string;
  @IsOptional() @IsString() address?: string;
  @IsOptional() @IsString() taxCode?: string;
}

export class UpdatePartnerDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsEnum(PartnerType) partnerType?: PartnerType;
  @IsOptional() @IsString() contactPerson?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() email?: string;
  @IsOptional() @IsString() address?: string;
  @IsOptional() @IsString() taxCode?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class PartnerFilterDto extends PaginationDto {
  @IsOptional() @IsEnum(PartnerType) type?: PartnerType;
  @IsOptional() @IsEnum(PartnerType) partnerType?: PartnerType;
  @IsOptional() @IsString() keyword?: string;
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true' || value === '1')
  @IsBoolean()
  isActive?: boolean;
}
