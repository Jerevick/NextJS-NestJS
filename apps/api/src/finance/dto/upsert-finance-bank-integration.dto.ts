import { IsBoolean, IsObject, IsOptional, IsString, MinLength } from 'class-validator';

export class UpsertFinanceBankIntegrationDto {
  @IsString()
  @MinLength(1)
  provider!: string;

  @IsOptional()
  @IsString()
  entityId?: string;

  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  webhookSecret?: string;
}
