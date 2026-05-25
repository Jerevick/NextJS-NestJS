import type { NewInstitutionValues } from './register-schema';

export const REGISTRATION_LOGO_MAX_MB = 2;
export const REGISTRATION_EVIDENCE_MAX_MB = 10;
export const REGISTRATION_TOTAL_UPLOAD_MAX_MB = 12;

const MAX_LOGO_BYTES = REGISTRATION_LOGO_MAX_MB * 1024 * 1024;
const MAX_EVIDENCE_BYTES = REGISTRATION_EVIDENCE_MAX_MB * 1024 * 1024;
const MAX_TOTAL_UPLOAD_BYTES = REGISTRATION_TOTAL_UPLOAD_MAX_MB * 1024 * 1024;
const LOGO_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);
const EVIDENCE_TYPES = new Set(['application/pdf', 'image/png', 'image/jpeg']);

export function validateLogoFile(logo: File | null | undefined): string | null {
  if (!logo?.size) {
    return `Institution logo is required (PNG, JPEG, or WebP, max ${REGISTRATION_LOGO_MAX_MB} MB).`;
  }
  if (logo.size > MAX_LOGO_BYTES) {
    return `Logo must be ${REGISTRATION_LOGO_MAX_MB} MB or smaller.`;
  }
  if (!LOGO_TYPES.has(logo.type)) {
    return 'Logo must be PNG, JPEG, or WebP.';
  }
  return null;
}

export function validateEvidenceFile(
  accreditationEvidence: File | null | undefined,
): string | null {
  if (!accreditationEvidence?.size) {
    return `Accreditation evidence is required (PDF or image, max ${REGISTRATION_EVIDENCE_MAX_MB} MB).`;
  }
  if (accreditationEvidence.size > MAX_EVIDENCE_BYTES) {
    return `Accreditation evidence must be ${REGISTRATION_EVIDENCE_MAX_MB} MB or smaller.`;
  }
  if (!EVIDENCE_TYPES.has(accreditationEvidence.type)) {
    return 'Evidence must be PDF, PNG, or JPEG.';
  }
  return null;
}

export function validateRegistrationFiles(
  logo: File | null | undefined,
  accreditationEvidence: File | null | undefined,
  accreditationStatus: NewInstitutionValues['accreditationStatus'],
): string | null {
  const logoError = validateLogoFile(logo);
  if (logoError) {
    return logoError;
  }

  if (accreditationStatus === 'not_accredited') {
    return null;
  }

  const evidenceError = validateEvidenceFile(accreditationEvidence);
  if (evidenceError) {
    return evidenceError;
  }

  const totalSize = (logo?.size ?? 0) + (accreditationEvidence?.size ?? 0);
  if (totalSize > MAX_TOTAL_UPLOAD_BYTES) {
    return `Logo and evidence combined must be ${REGISTRATION_TOTAL_UPLOAD_MAX_MB} MB or smaller.`;
  }

  return null;
}
