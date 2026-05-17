import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString } from 'class-validator';
import { Type } from 'class-transformer';

export class EvaluateProgressionBatchDto {
  @ApiProperty({ description: 'Semester to evaluate (students with enrollments in this term).' })
  @IsString()
  semesterId!: string;

  @ApiPropertyOptional({
    description: 'When true or omitted, classify only; no decisions or workflows are written.',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  dryRun?: boolean;

  @ApiPropertyOptional({
    description:
      'When dryRun is false and this is true, start academic review workflows for conditional / repeat / max-duration classifications.',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  initiateReviewWorkflows?: boolean;
}
