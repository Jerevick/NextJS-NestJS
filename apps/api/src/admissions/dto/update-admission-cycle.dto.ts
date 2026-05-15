import { AdmissionCycleStatus } from '@prisma/client';
import { IsDateString, IsEnum, IsObject, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateAdmissionCycleDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsDateString()
  applicationOpenDate?: string;

  @IsOptional()
  @IsDateString()
  applicationCloseDate?: string;

  @IsOptional()
  @IsEnum(AdmissionCycleStatus)
  status?: AdmissionCycleStatus;

  @IsOptional()
  @IsObject()
  quota?: Record<string, unknown>;
}
