import { IsIn, IsNumber, IsObject, IsOptional, IsString, Min } from 'class-validator';

export class SubmitScholarshipApplicationDto {
  @IsOptional()
  @IsObject()
  responses?: Record<string, unknown>;
}

export class ReviewScholarshipApplicationDto {
  @IsIn(['APPROVED', 'REJECTED'])
  status!: 'APPROVED' | 'REJECTED';

  @IsOptional()
  @IsString()
  reviewNotes?: string;

  @IsOptional()
  @IsString()
  academicYearId?: string;

  @IsOptional()
  @IsNumber()
  @Min(0.01)
  awardAmount?: number;
}
