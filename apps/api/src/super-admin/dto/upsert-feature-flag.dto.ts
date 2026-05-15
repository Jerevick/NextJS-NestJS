import { Type } from 'class-transformer';
import { IsBoolean, IsInt, IsString, Max, Min, MinLength } from 'class-validator';

export class UpsertFeatureFlagDto {
  @IsString()
  @MinLength(2)
  key!: string;

  @IsString()
  @MinLength(2)
  description!: string;

  @Type(() => Boolean)
  @IsBoolean()
  defaultEnabled!: boolean;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  rolloutPercent!: number;
}
