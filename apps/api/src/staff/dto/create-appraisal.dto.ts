import { AppraisalType } from '@prisma/client';
import { IsDateString, IsEnum, IsOptional, IsString } from 'class-validator';

export class CreateStaffAppraisalDto {
  @IsString()
  staffId!: string;

  @IsOptional()
  @IsString()
  reviewerId?: string;

  @IsDateString()
  periodStart!: string;

  @IsDateString()
  periodEnd!: string;

  @IsOptional()
  @IsEnum(AppraisalType)
  type?: AppraisalType;
}
