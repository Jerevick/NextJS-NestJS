import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min, MinLength } from 'class-validator';

export class SummarizeLessonDto {
  @IsString()
  lessonId!: string;

  @IsOptional()
  @IsString()
  content?: string;
}

export class GenerateQuizDto {
  @IsString()
  lessonId!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  count?: number;

  @IsOptional()
  @IsIn(['easy', 'medium', 'hard'])
  difficulty?: 'easy' | 'medium' | 'hard';

  @IsOptional()
  @IsString()
  content?: string;
}

export class GenerateRubricDto {
  @IsString()
  @MinLength(10)
  assignmentDescription!: string;
}

export class EssayFeedbackDto {
  @IsString()
  submissionId!: string;

  @IsOptional()
  draftOnly?: boolean;
}
