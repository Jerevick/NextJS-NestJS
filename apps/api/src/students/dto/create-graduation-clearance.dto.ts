import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateGraduationClearanceDto {
  @IsString()
  @MinLength(1)
  studentId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  justification?: string;
}
