import { IsBoolean, IsEmail, IsOptional, IsString, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';

export class LoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  /** Used when host does not resolve a tenant (e.g. localhost). */
  @IsOptional()
  @IsString()
  institutionSlug?: string;

  @IsOptional()
  @IsString()
  mfaToken?: string;

  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true' || value === '1' || value === 1)
  @IsBoolean()
  rememberMe?: boolean;
}
