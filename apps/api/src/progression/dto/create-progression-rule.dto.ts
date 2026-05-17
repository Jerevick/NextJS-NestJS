import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';
import { GpaRepeatPolicy, ProgressionRuleScope } from '@prisma/client';

export class CreateProgressionRuleDto {
  @IsEnum(ProgressionRuleScope)
  ruleScope!: ProgressionRuleScope;

  /** Required when `ruleScope` is PROGRAM; must be omitted for INSTITUTION-wide rules. */
  @IsOptional()
  @IsString()
  programId?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(4)
  @Type(() => Number)
  minGpaPromotion?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(4)
  @Type(() => Number)
  conditionalPromotionMinGpa?: number;

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
  maxProgrammeDurationYears?: number;

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
