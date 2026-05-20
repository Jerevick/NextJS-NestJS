import { BadRequestException } from '@nestjs/common';
import { assertUploadMimeMatchesMagicBytes } from '../common/security/upload-magic-bytes.util';

export const REGISTRATION_LOGO_MIME = new Set(['image/png', 'image/jpeg', 'image/webp']);
export const REGISTRATION_EVIDENCE_MIME = new Set(['application/pdf', 'image/png', 'image/jpeg']);

const MAX_LOGO_BYTES = 2 * 1024 * 1024;
const MAX_EVIDENCE_BYTES = 10 * 1024 * 1024;

function assertFileSize(file: Express.Multer.File, maxBytes: number, label: string) {
  if (!file.buffer?.length) {
    throw new BadRequestException(`${label} file is required`);
  }
  if (file.buffer.length > maxBytes) {
    throw new BadRequestException(
      `${label} must be at most ${Math.round(maxBytes / 1024 / 1024)} MB`,
    );
  }
}

export function assertRegistrationLogo(file: Express.Multer.File | undefined): Express.Multer.File {
  if (!file) {
    throw new BadRequestException('Institution logo is required');
  }
  assertFileSize(file, MAX_LOGO_BYTES, 'Logo');
  const mime = assertUploadMimeMatchesMagicBytes(
    file.buffer,
    file.mimetype,
    REGISTRATION_LOGO_MIME,
  );
  file.mimetype = mime;
  return file;
}

export function assertRegistrationEvidence(
  file: Express.Multer.File | undefined,
  accreditationStatus: string,
): Express.Multer.File | undefined {
  if (accreditationStatus === 'not_accredited') {
    return undefined;
  }
  if (!file) {
    throw new BadRequestException('Accreditation evidence document is required');
  }
  assertFileSize(file, MAX_EVIDENCE_BYTES, 'Accreditation evidence');
  const mime = assertUploadMimeMatchesMagicBytes(
    file.buffer,
    file.mimetype,
    REGISTRATION_EVIDENCE_MIME,
  );
  file.mimetype = mime;
  return file;
}

export function registrationIntakeExtension(mime: string): string {
  if (mime === 'image/png') return 'png';
  if (mime === 'image/jpeg') return 'jpg';
  if (mime === 'image/webp') return 'webp';
  if (mime === 'application/pdf') return 'pdf';
  return 'bin';
}
