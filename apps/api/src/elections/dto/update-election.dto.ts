import { IsDateString, IsEnum, IsObject, IsOptional, IsString, MinLength } from 'class-validator';
import { ElectionStatus } from '@prisma/client';

export class UpdateElectionDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(ElectionStatus)
  status?: ElectionStatus;

  @IsOptional()
  @IsObject()
  eligibilityRules?: Record<string, unknown>;

  @IsOptional()
  @IsDateString()
  nominationOpenDate?: string;

  @IsOptional()
  @IsDateString()
  nominationCloseDate?: string;

  @IsOptional()
  @IsDateString()
  votingOpenDate?: string;

  @IsOptional()
  @IsDateString()
  votingCloseDate?: string;
}
