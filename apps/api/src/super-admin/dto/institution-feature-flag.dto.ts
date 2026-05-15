import { Type } from 'class-transformer';
import { IsBoolean, IsString, MinLength } from 'class-validator';

export class InstitutionFeatureFlagDto {
  @IsString()
  @MinLength(2)
  flagKey!: string;

  @Type(() => Boolean)
  @IsBoolean()
  enabled!: boolean;
}
