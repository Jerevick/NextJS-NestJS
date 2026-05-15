import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class ConfirmGraduationDto {
  @IsString()
  @MinLength(3)
  @MaxLength(2000)
  reason!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
