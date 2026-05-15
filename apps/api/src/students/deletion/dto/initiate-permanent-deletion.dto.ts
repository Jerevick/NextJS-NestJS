import { IsString, MaxLength, MinLength } from 'class-validator';

export class InitiatePermanentDeletionDto {
  @IsString()
  @MinLength(3)
  @MaxLength(64)
  typedStudentNumber!: string;

  @IsString()
  @MinLength(10)
  @MaxLength(4000)
  justification!: string;
}
