import { IsEnum, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';
import {
  ProgressionDecisionKind,
  ProgressionPromotionSubtype,
  ProgressionRepeatSubtype,
} from '@prisma/client';

export class CreateProgressionDecisionDto {
  @IsString()
  studentId!: string;

  @IsEnum(ProgressionDecisionKind)
  kind!: ProgressionDecisionKind;

  @IsOptional()
  @IsEnum(ProgressionPromotionSubtype)
  promotionSubtype?: ProgressionPromotionSubtype;

  @IsOptional()
  @IsEnum(ProgressionRepeatSubtype)
  repeatSubtype?: ProgressionRepeatSubtype;

  @IsOptional()
  @IsString()
  semesterId?: string;

  @IsOptional()
  @IsString()
  academicYearId?: string;

  @IsOptional()
  @IsString()
  priorDecisionId?: string;

  @IsOptional()
  @IsObject()
  payload?: Record<string, unknown>;

  /** Defaults to student's current programme when omitted. */
  @IsOptional()
  @IsString()
  programId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  justification?: string;
}
