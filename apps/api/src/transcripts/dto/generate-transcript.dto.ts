import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString, MinLength } from 'class-validator';

export class GenerateTranscriptDto {
  @IsString()
  @MinLength(1)
  studentId!: string;

  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  isOfficial?: boolean;
}
