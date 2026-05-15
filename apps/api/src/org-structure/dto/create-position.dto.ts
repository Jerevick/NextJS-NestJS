import { PositionScope } from '@prisma/client';
import { IsArray, IsBoolean, IsEnum, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

export class CreatePositionDto {
  @IsString()
  entityId!: string;

  @IsString()
  orgUnitId!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(32)
  code!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title!: string;

  @IsInt()
  @Min(1)
  @Max(7)
  level!: number;

  @IsEnum(PositionScope)
  scope!: PositionScope;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  permissionBundles?: string[];

  @IsOptional()
  @IsBoolean()
  isUnique?: boolean;
}
