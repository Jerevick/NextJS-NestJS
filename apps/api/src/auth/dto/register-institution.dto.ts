import { TenantModule } from '@prisma/client';
import {
  ArrayMinSize,
  IsArray,
  IsEmail,
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { REGISTRATION_TENANT_MODULES } from '../../common/tenant-modules/tenant-module-packages';

export const ACCREDITATION_STATUS_VALUES = [
  'accredited',
  'provisional',
  'application_pending',
  'not_accredited',
] as const;

export type AccreditationStatus = (typeof ACCREDITATION_STATUS_VALUES)[number];

export class RegisterInstitutionDto {
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  institutionName!: string;

  @IsEnum(['university', 'college', 'polytechnic', 'other'])
  institutionType!: 'university' | 'college' | 'polytechnic' | 'other';

  @IsEmail()
  institutionEmail!: string;

  @IsString()
  @MinLength(3)
  @MaxLength(200)
  addressLine1!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  addressLine2?: string;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  city!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  stateProvince!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(32)
  postalCode!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(80)
  country!: string;

  @IsIn(ACCREDITATION_STATUS_VALUES)
  accreditationStatus!: AccreditationStatus;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  accreditationBody?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  accreditationReference?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  accreditationValidUntil?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(80)
  contactFirstName!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(80)
  contactLastName!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  contactTitle!: string;

  @IsString()
  @MinLength(6)
  @MaxLength(40)
  contactPhone!: string;

  @IsEmail()
  contactEmail!: string;

  @IsEnum(['under-500', '500-2000', '2000-10000', '10000-plus'])
  estimatedStudents!: 'under-500' | '500-2000' | '2000-10000' | '10000-plus';

  @IsArray()
  @ArrayMinSize(1)
  @IsIn(REGISTRATION_TENANT_MODULES, { each: true })
  modulesInterested!: TenantModule[];

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  message?: string;
}
