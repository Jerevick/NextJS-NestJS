import { IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

export class GradeLmsSubmissionDto {
  @IsObject()
  grade!: Record<string, unknown>;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  feedback?: string;
}
