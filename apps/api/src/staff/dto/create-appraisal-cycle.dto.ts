import { AppraisalType } from '@prisma/client';
import { IsArray, IsDateString, IsEnum, IsOptional, IsString } from 'class-validator';

export class CreateAppraisalCycleDto {
  @IsDateString()
  periodStart!: string;

  @IsDateString()
  periodEnd!: string;

  @IsOptional()
  @IsEnum(AppraisalType)
  type?: AppraisalType;

  /** When omitted, opens a draft appraisal for every staff profile in the entity. */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  staffIds?: string[];
}
