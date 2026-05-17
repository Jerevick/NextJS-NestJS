import { IsString, MinLength } from 'class-validator';

export class StartQuizAttemptDto {
  @IsString()
  @MinLength(1)
  studentId!: string;
}
