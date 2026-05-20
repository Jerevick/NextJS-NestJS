import type { NewInstitutionValues } from './register-schema';

const MAX_LOGO_BYTES = 2 * 1024 * 1024;
const MAX_EVIDENCE_BYTES = 10 * 1024 * 1024;
const LOGO_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);
const EVIDENCE_TYPES = new Set(['application/pdf', 'image/png', 'image/jpeg']);

export function validateLogoFile(logo: File | null | undefined): string | null {
  if (!logo?.size) {
    return 'Institution logo is required (PNG, JPEG, or WebP, max 2 MB).';
  }
  if (logo.size > MAX_LOGO_BYTES) {
    return 'Logo must be 2 MB or smaller.';
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
    return 'Accreditation evidence is required (PDF or image, max 10 MB).';
  }
  if (accreditationEvidence.size > MAX_EVIDENCE_BYTES) {
    return 'Accreditation evidence must be 10 MB or smaller.';
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

  return validateEvidenceFile(accreditationEvidence);
}
