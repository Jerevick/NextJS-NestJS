import { IsString, MaxLength, MinLength } from 'class-validator';

export class VerifyStudentEnrollmentDto {
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  institutionSlug!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(64)
  studentNumber!: string;
}
