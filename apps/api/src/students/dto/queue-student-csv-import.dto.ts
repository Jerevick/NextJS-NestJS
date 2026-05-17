import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class QueueStudentCsvImportDto {
  /** Raw CSV contents (header row + data rows). */
  @IsString()
  @MinLength(2)
  @MaxLength(2_500_000)
  csvText!: string;

  /** Optional MAIN/SCHOOL entity id hint for student.default entity resolution. */
  @IsOptional()
  @IsString()
  entityId?: string;
}
