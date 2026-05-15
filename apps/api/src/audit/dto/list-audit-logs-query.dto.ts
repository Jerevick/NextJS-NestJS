import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min, MinLength } from 'class-validator';

export class ListAuditLogsQueryDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  entity?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  action?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  entityId?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  from?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  to?: string;

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
