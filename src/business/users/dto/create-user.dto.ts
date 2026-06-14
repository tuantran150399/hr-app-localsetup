import { IsBoolean, IsEmail, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateUserDto {
  @IsNotEmpty() @IsString() username: string;
  @IsEmail() email: string;
  @IsNotEmpty() @MinLength(6) password: string;
  @IsOptional() @IsString() fullName?: string;
  @IsOptional() branchId?: number;
  @IsOptional() @IsBoolean() canAccessAllBranches?: boolean;
  @IsOptional() roleIds?: number[];
}
