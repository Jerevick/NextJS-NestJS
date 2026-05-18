import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { StudentEnrollmentStatusEnum } from '@prisma/client';

export class UpdateStudentDto {
  @IsOptional()
  @IsString()
  programId?: string;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  currentLevel?: number;

  @IsOptional()
  @IsEnum(StudentEnrollmentStatusEnum)
  enrollmentStatus?: StudentEnrollmentStatusEnum;

  /** Required when `enrollmentStatus` is present and differs from the current value (immutable status log). */
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  statusChangeReason?: string;

  @IsOptional()
  @IsDateString()
  admissionDate?: string;

  @IsOptional()
  @IsDateString()
  expectedGraduationDate?: string;

  @IsOptional()
  @IsArray()
  guardians?: unknown[];

  @IsOptional()
  @IsArray()
  emergencyContacts?: unknown[];

  @IsOptional()
  @IsObject()
  specialNeeds?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  photo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  careerGoals?: string;

  @IsOptional()
  @IsBoolean()
  aiSuggested?: boolean;

  @IsOptional()
  @IsBoolean()
  humanConfirmed?: boolean;
}
