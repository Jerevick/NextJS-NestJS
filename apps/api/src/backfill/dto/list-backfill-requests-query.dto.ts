import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min, MinLength } from 'class-validator';
import { BackfillRequestStatus } from '@prisma/client';

export class ListBackfillRequestsQueryDto {
  @IsOptional()
  @IsEnum(BackfillRequestStatus)
  status?: BackfillRequestStatus;

  @IsOptional()
  @IsString()
  @MinLength(1)
  studentId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @IsString()
  cursor?: string;
}
