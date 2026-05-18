import { Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class KpiTemplateItemDto {
  @IsString()
  @MinLength(1)
  key!: string;

  @IsString()
  @MinLength(1)
  label!: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  weight?: number;
}

export class UpsertKpiTemplateDto {
  /** Configure by position code (e.g. LEC, HOD). */
  @IsOptional()
  @IsString()
  positionCode?: string;

  /** Configure by position level (integer). */
  @IsOptional()
  @IsInt()
  positionLevel?: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => KpiTemplateItemDto)
  template!: KpiTemplateItemDto[];
}
