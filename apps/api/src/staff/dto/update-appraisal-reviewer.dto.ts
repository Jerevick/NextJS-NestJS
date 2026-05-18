import { IsNumber, IsObject, IsOptional, IsString, Max, Min } from 'class-validator';

export class UpdateAppraisalReviewerDto {
  @IsOptional()
  @IsString()
  reviewerComments?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(5)
  overallRating?: number;

  @IsOptional()
  @IsObject()
  kpiScores?: Record<string, unknown>;
}
