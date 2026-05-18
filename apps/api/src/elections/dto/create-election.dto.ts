import {
  IsArray,
  IsDateString,
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ElectionScope, ElectionType } from '@prisma/client';

class ElectionPositionDto {
  @IsString()
  @MinLength(1)
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  maxCandidates?: number;
}

export class CreateElectionDto {
  @IsString()
  @MinLength(2)
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(ElectionType)
  type?: ElectionType;

  @IsOptional()
  @IsEnum(ElectionScope)
  scope?: ElectionScope;

  @IsOptional()
  @IsString()
  eligibilityOrgUnitId?: string;

  @IsOptional()
  @IsObject()
  eligibilityRules?: Record<string, unknown>;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ElectionPositionDto)
  positions!: ElectionPositionDto[];

  @IsDateString()
  nominationOpenDate!: string;

  @IsDateString()
  nominationCloseDate!: string;

  @IsDateString()
  votingOpenDate!: string;

  @IsDateString()
  votingCloseDate!: string;
}
