import { IsArray, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class UpsertWorkloadDto {
  @IsString()
  staffId!: string;

  @IsString()
  semesterId!: string;

  @IsOptional()
  @IsArray()
  assignedSections?: unknown[];

  @IsOptional()
  @IsInt()
  @Min(0)
  totalCreditHours?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxCreditHours?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  researchHours?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  adminHours?: number;
}
