import { BadRequestException } from '@nestjs/common';
import { TenantModule } from '@prisma/client';
import { REGISTRATION_TENANT_MODULES } from '../common/tenant-modules/tenant-module-packages';
import type { RegisterInstitutionDto } from './dto/register-institution.dto';

const ACCREDITATION_STATUSES = [
  'accredited',
  'provisional',
  'application_pending',
  'not_accredited',
] as const;

function requiredString(body: Record<string, string>, key: string, label: string): string {
  const v = body[key]?.trim();
  if (!v) {
    throw new BadRequestException(`${label} is required`);
  }
  return v;
}

function optionalString(body: Record<string, string>, key: string): string | undefined {
  const v = body[key]?.trim();
  return v || undefined;
}

export function parseRegisterInstitutionBody(body: Record<string, string>): RegisterInstitutionDto {
  const modulesRaw = body.modulesInterested?.trim();
  let modulesInterested: TenantModule[];
  try {
    const parsed = JSON.parse(modulesRaw ?? '[]') as unknown;
    if (!Array.isArray(parsed)) {
      throw new Error('invalid');
    }
    modulesInterested = parsed.filter((m): m is TenantModule =>
      REGISTRATION_TENANT_MODULES.includes(m as TenantModule),
    );
  } catch {
    throw new BadRequestException('modulesInterested must be a JSON array of package codes');
  }

  const accreditationStatus = requiredString(body, 'accreditationStatus', 'Accreditation status');
  if (
    !ACCREDITATION_STATUSES.includes(accreditationStatus as (typeof ACCREDITATION_STATUSES)[number])
  ) {
    throw new BadRequestException('Invalid accreditation status');
  }

  const institutionType = requiredString(body, 'institutionType', 'Institution type');
  if (!['university', 'college', 'polytechnic', 'other'].includes(institutionType)) {
    throw new BadRequestException('Invalid institution type');
  }

  const dto: RegisterInstitutionDto = {
    institutionName: requiredString(body, 'institutionName', 'Institution legal name'),
    institutionType: institutionType as RegisterInstitutionDto['institutionType'],
    institutionEmail: requiredString(body, 'institutionEmail', 'Institutional email'),
    addressLine1: requiredString(body, 'addressLine1', 'Street address'),
    addressLine2: optionalString(body, 'addressLine2'),
    city: requiredString(body, 'city', 'City'),
    stateProvince: requiredString(body, 'stateProvince', 'State / province / region'),
    postalCode: requiredString(body, 'postalCode', 'Postal code'),
    country: requiredString(body, 'country', 'Country'),
    accreditationStatus: accreditationStatus as RegisterInstitutionDto['accreditationStatus'],
    accreditationBody: optionalString(body, 'accreditationBody'),
    accreditationReference: optionalString(body, 'accreditationReference'),
    accreditationValidUntil: optionalString(body, 'accreditationValidUntil'),
    contactFirstName: requiredString(body, 'contactFirstName', 'Contact first name'),
    contactLastName: requiredString(body, 'contactLastName', 'Contact last name'),
    contactTitle: requiredString(body, 'contactTitle', 'Contact job title'),
    contactPhone: requiredString(body, 'contactPhone', 'Contact phone'),
    contactEmail: requiredString(body, 'contactEmail', 'Contact email'),
    modulesInterested,
    estimatedStudents: optionalString(body, 'estimatedStudents') as
      | RegisterInstitutionDto['estimatedStudents']
      | undefined,
    message: optionalString(body, 'message'),
  };

  if (
    dto.accreditationStatus !== 'not_accredited' &&
    (!dto.accreditationBody || dto.accreditationBody.length < 2)
  ) {
    throw new BadRequestException(
      'Accrediting body is required when accreditation status is not "not accredited"',
    );
  }

  return dto;
}
