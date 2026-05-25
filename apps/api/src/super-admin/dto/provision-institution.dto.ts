import { Type } from 'class-transformer';
import {
  IsEmail,
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
} from 'class-validator';
import { PlanTier, TenantModule } from '@prisma/client';

export class ProvisionInstitutionDto {
  @IsOptional()
  @IsString()
  registrationRequestId?: string;

  @IsOptional()
  @IsString()
  slug?: string;

  @IsString()
  @MinLength(2)
  name!: string;

  @IsOptional()
  @IsString()
  domain?: string | null;

  @IsOptional()
  @IsEnum(PlanTier)
  plan?: PlanTier;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1_000_000)
  maxStudents?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(28)
  billingDayOfMonth?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(90)
  disputeWindowDays?: number;

  @IsEmail()
  adminEmail!: string;

  @IsString()
  @IsOptional()
  adminPassword?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  adminFirstName?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  adminLastName?: string;

  @IsOptional()
  @IsString()
  subscriptionAmount?: string;

  @IsOptional()
  modules?: Array<{ module: TenantModule; enabled: boolean }>;

  @IsOptional()
  @IsObject()
  settings?: Record<string, unknown>;
}
