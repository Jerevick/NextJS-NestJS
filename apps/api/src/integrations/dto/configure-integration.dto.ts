import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsObject, IsOptional, IsString } from 'class-validator';

export class ConfigureIntegrationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  entityId?: string;

  @ApiProperty({ type: 'object', additionalProperties: true })
  @IsObject()
  settings!: Record<string, unknown>;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}
