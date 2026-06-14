import { IsEmail, IsOptional, IsString, IsBoolean } from 'class-validator';

export class UpdateUserDto {
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() fullName?: string;
  @IsOptional() branchId?: number;
  @IsOptional() @IsBoolean() canAccessAllBranches?: boolean;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() roleIds?: number[];
}
