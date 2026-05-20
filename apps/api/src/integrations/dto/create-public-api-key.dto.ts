import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsInt, IsOptional, IsString, Max, Min, MinLength } from 'class-validator';

export class CreatePublicApiKeyDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  name!: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  scopes?: string[];

  @ApiPropertyOptional({ default: 60 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10_000)
  rateLimitPerMinute?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  entityId?: string;
}
