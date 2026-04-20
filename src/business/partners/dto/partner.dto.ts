import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { PartnerType } from '../../../models/partner.entity';

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
  @IsOptional() isActive?: boolean;
}