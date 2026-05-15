import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min, MinLength } from 'class-validator';
import { InstitutionStatus } from '@prisma/client';

export class ListInstitutionsQueryDto {
  @IsOptional()
  @IsEnum(InstitutionStatus)
  status?: InstitutionStatus;

  @IsOptional()
  @IsString()
  @MinLength(1)
  search?: string;

  @IsOptional()
  @IsString()
  cursor?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
