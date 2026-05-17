import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsNumber, IsOptional, Max, Min } from 'class-validator';
import { GpaRepeatPolicy } from '@prisma/client';

export class UpdateProgressionRuleDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(4)
  @Type(() => Number)
  minGpaPromotion?: number | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(4)
  @Type(() => Number)
  conditionalPromotionMinGpa?: number | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(20)
  maxCarryoverCourses?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  maxRepeatAttemptsPerLevel?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20)
  maxProgrammeDurationYears?: number | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(5)
  maxResitAttempts?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  @Type(() => Number)
  resitGradeCapPercent?: number;

  @IsOptional()
  @IsEnum(GpaRepeatPolicy)
  gpaRepeatPolicy?: GpaRepeatPolicy;
}
