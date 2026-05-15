import { IsBoolean, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateLmsCourseInstanceDto {
  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  coverImage?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(20_000)
  welcomeMessage?: string | null;

  @IsOptional()
  @IsObject()
  settings?: Record<string, unknown>;
}
