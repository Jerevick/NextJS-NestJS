import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { ReactivationRequestStatus } from '@prisma/client';

export class ListReactivationRequestsQueryDto {
  @IsOptional()
  @IsString()
  cursor?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @IsEnum(ReactivationRequestStatus)
  status?: ReactivationRequestStatus;

  @IsOptional()
  @IsString()
  studentId?: string;
}
