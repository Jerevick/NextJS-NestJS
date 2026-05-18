import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class UpdateAlumniProfileDto {
  @IsOptional()
  @IsInt()
  @Min(1950)
  @Type(() => Number)
  graduationYear?: number;

  @IsOptional()
  @IsString()
  @MaxLength(256)
  currentEmployer?: string;

  @IsOptional()
  @IsString()
  @MaxLength(256)
  jobTitle?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  industry?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  bio?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  expertiseAreas?: string[];

  @IsOptional()
  @IsBoolean()
  mentorshipAvailable?: boolean;
}
