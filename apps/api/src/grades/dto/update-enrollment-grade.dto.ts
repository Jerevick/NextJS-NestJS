import { Type } from 'class-transformer';
import { IsIn, IsNumber, IsObject, IsOptional, IsString, Max, Min } from 'class-validator';

export class UpdateEnrollmentGradeDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  score?: number;

  @IsOptional()
  @IsString()
  letterGrade?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(20)
  gradePoints?: number;

  @IsOptional()
  @IsObject()
  components?: Record<string, unknown>;

  @IsOptional()
  @IsIn(['DRAFT', 'SUBMITTED', 'APPROVED'])
  workflowStatus?: 'DRAFT' | 'SUBMITTED' | 'APPROVED';
}
