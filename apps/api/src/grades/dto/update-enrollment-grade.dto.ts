import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

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

  /** When true, grade change was suggested by AI and requires humanConfirmed. */
  @IsOptional()
  @IsBoolean()
  aiSuggested?: boolean;

  @IsOptional()
  @IsBoolean()
  humanConfirmed?: boolean;
}
