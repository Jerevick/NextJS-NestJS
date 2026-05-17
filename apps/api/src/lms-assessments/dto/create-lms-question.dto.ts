import { LmsQuestionType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateLmsQuestionDto {
  @IsEnum(LmsQuestionType)
  type!: LmsQuestionType;

  /** MCQ: { prompt, options[], correctAnswer? | correctOptionIndex? }; TRUE_FALSE: { prompt, correctAnswer: 'True'|'False' } */
  @IsObject()
  content!: Record<string, unknown>;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1000)
  points?: number;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  explanation?: string | null;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  /** Append default: max(sortOrder)+1 */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;
}
