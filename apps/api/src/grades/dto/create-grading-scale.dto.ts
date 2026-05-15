import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export class GradingScaleBandDto {
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  min!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  max!: number;

  @IsString()
  letter!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(20)
  points!: number;
}

export class CreateGradingScaleDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GradingScaleBandDto)
  scale!: GradingScaleBandDto[];
}
