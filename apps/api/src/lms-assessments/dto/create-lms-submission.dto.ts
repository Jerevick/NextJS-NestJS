import { IsObject, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateLmsSubmissionDto {
  @IsString()
  @MinLength(1)
  studentId!: string;

  @IsOptional()
  @IsObject()
  answers?: Record<string, unknown>;
}
