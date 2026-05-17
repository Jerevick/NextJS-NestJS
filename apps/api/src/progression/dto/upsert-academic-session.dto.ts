import { StudentSessionRepeatReason } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class UpsertAcademicSessionDto {
  @IsString()
  studentId!: string;

  @IsString()
  programId!: string;

  @IsString()
  academicYearId!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  studyLevel!: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  attemptNumber?: number;

  @IsOptional()
  @IsEnum(StudentSessionRepeatReason)
  repeatReason?: StudentSessionRepeatReason;
}
