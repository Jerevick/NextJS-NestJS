import { IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

export class PatchInstitutionSettingsDto {
  @IsObject()
  patch!: Record<string, unknown>;
}

export class PatchEntitySettingsDto {
  @IsObject()
  patch!: Record<string, unknown>;
}

export class PatchBrandingDto {
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
}
