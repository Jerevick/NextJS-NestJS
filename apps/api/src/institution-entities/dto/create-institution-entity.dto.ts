import { InstitutionEntityType } from '@prisma/client';
import { IsEnum, IsIn, IsObject, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import type { EntityBillingClassification, EntityCoupling } from '../entity-settings.types';

const COUPLINGS = ['INTERNAL', 'PARTIAL', 'EXTERNAL'] as const;
const BILLING = ['BILLED_TO_PARENT', 'BILLED_INDEPENDENTLY', 'EXEMPT'] as const;

export class CreateInstitutionEntityDto {
  @IsString()
  @MinLength(1)
  @MaxLength(32)
  code!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name!: string;

  @IsEnum(InstitutionEntityType)
  type!: InstitutionEntityType;

  @IsOptional()
  @IsIn(COUPLINGS)
  coupling?: EntityCoupling;

  @IsOptional()
  @IsIn(BILLING)
  billingClassification?: EntityBillingClassification;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  shortName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsObject()
  settings?: Record<string, unknown>;
}
