import { IsObject, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateInstitutionEntityDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  shortName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  location?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  logoUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  primaryColor?: string;

  @IsOptional()
  @IsString()
  @MaxLength(253)
  customDomain?: string;

  /** Partial merge into entity `settings` JSON (excluding type/code/coupling overrides). */
  @IsOptional()
  @IsObject()
  settingsPatch?: Record<string, unknown>;
}
