import { IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

export class ScormCommitDto {
  @IsOptional()
  @IsString()
  @MaxLength(32)
  lessonStatus?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  completionStatus?: string;

  @IsOptional()
  @IsString()
  @MaxLength(16)
  scoreRaw?: string;

  @IsOptional()
  @IsObject()
  cmi?: Record<string, string>;
}
