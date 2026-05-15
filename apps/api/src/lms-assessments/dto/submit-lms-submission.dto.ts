import { IsObject, IsOptional } from 'class-validator';

export class SubmitLmsSubmissionDto {
  @IsOptional()
  @IsObject()
  answers?: Record<string, unknown>;
}
