import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUrl, MinLength } from 'class-validator';

export class CreateWebhookDto {
  @ApiProperty({ example: 'student.enrolled' })
  @IsString()
  @MinLength(3)
  event!: string;

  @ApiProperty({ example: 'https://example.com/hooks/unicore' })
  @IsUrl({ require_tld: false })
  url!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  entityId?: string;
}
