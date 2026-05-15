import { IsArray, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateApplicationDto {
  @IsString()
  @MinLength(1)
  cycleId!: string;

  @IsString()
  @MinLength(1)
  programId!: string;

  @IsString()
  @MinLength(1)
  applicantId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(20_000)
  personalStatement?: string;

  @IsOptional()
  @IsArray()
  documents?: unknown[];
}
