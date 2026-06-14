import { IsDateString, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class BlockUserDto {
  @IsNotEmpty()
  @IsString()
  @MaxLength(500)
  reason: string;

  @IsOptional()
  @IsDateString()
  blockedUntil?: string;
}
