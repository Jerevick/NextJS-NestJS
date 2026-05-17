import { Type } from 'class-transformer';
import { IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export class RegisterResitDto {
  @IsString()
  enrollmentId!: string;

  /** Optional cap percentage (0–100). Defaults to institution/program rule or 40. */
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  gradeCapPercent?: number;
}
