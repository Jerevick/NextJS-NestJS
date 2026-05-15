import { AdmissionCycleStatus } from '@prisma/client';
import { IsDateString, IsEnum, IsObject, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateAdmissionCycleDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name!: string;

  @IsString()
  @MinLength(1)
  academicYearId!: string;

  @IsDateString()
  applicationOpenDate!: string;

  @IsDateString()
  applicationCloseDate!: string;

  @IsOptional()
  @IsEnum(AdmissionCycleStatus)
  status?: AdmissionCycleStatus;

  @IsOptional()
  @IsObject()
  quota?: Record<string, unknown>;
}
