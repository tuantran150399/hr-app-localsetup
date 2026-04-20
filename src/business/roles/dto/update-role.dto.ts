import { IsOptional, IsString } from 'class-validator';

export class UpdateRoleDto {
  @IsOptional() @IsString() description?: string;
  @IsOptional() permissionIds?: number[];
}