import { Type } from 'class-transformer';
import {
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class GradeComponentWeightRowDto {
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  @Matches(/^[a-zA-Z][a-zA-Z0-9_-]*$/, {
    message: 'key must start with a letter and use only letters, numbers, underscore, hyphen',
  })
  key!: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  label?: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 8 })
  @Min(0.000001)
  @Max(1)
  weight!: number;
}

export class PatchGradeComponentWeightsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GradeComponentWeightRowDto)
  componentWeights!: GradeComponentWeightRowDto[];
}
