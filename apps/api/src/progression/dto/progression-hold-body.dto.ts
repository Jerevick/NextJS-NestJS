import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { StudentProgressionHoldType } from '@prisma/client';

/** Body for `POST sis/progression/students/:studentId/holds`. */
export class ProgressionHoldBodyDto {
  @IsEnum(StudentProgressionHoldType)
  type!: StudentProgressionHoldType;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  reason?: string;

  @IsOptional()
  @IsString()
  semesterId?: string;
}
