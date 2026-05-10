import { Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsIn, IsInt, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';
import { IpAccessRuleType } from '../../../models/ip-access-rule.entity';
import { SecurityAlertStatus, SecurityAlertType } from '../../../models/security-alert.entity';
import { LoginEventStatus } from '../../../models/security-login-event.entity';

export class SecurityLoginEventFilterDto extends PaginationDto {
  @IsOptional() @Type(() => Number) @IsInt() userId?: number;
  @IsOptional() @IsString() username?: string;
  @IsOptional() @IsEnum(LoginEventStatus) status?: LoginEventStatus;
  @IsOptional() @IsString() ipAddress?: string;
  @IsOptional() @IsString() dateFrom?: string;
  @IsOptional() @IsString() dateTo?: string;
}

export class SecurityAlertFilterDto extends PaginationDto {
  @IsOptional() @Type(() => Number) @IsInt() userId?: number;
  @IsOptional() @IsEnum(SecurityAlertStatus) status?: SecurityAlertStatus;
  @IsOptional() @IsEnum(SecurityAlertType) type?: SecurityAlertType;
  @IsOptional() @IsString() dateFrom?: string;
  @IsOptional() @IsString() dateTo?: string;
}

export class IpAccessRuleFilterDto extends PaginationDto {
  @IsOptional() @IsEnum(IpAccessRuleType) type?: IpAccessRuleType;
  @IsOptional() @Type(() => Boolean) @IsBoolean() isActive?: boolean;
}

export class CreateIpAccessRuleDto {
  @IsEnum(IpAccessRuleType) type: IpAccessRuleType;
  @IsNotEmpty() @IsString() ipPattern: string;
  @IsNotEmpty() @IsString() label: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class UpdateIpAccessRuleDto {
  @IsOptional() @IsEnum(IpAccessRuleType) type?: IpAccessRuleType;
  @IsOptional() @IsString() ipPattern?: string;
  @IsOptional() @IsString() label?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class UpdateSecurityAlertStatusDto {
  @IsIn([SecurityAlertStatus.ACKNOWLEDGED, SecurityAlertStatus.RESOLVED])
  status: SecurityAlertStatus.ACKNOWLEDGED | SecurityAlertStatus.RESOLVED;
}
