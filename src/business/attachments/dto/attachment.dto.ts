import { IsNotEmpty, IsOptional, IsString, IsInt, IsIn } from 'class-validator';
import { Type } from 'class-transformer';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class AttachmentFilterDto extends PaginationDto {
  @IsOptional() @IsString() moduleName?: string;
  @IsOptional() @Type(() => Number) @IsInt() entityId?: number;
}
