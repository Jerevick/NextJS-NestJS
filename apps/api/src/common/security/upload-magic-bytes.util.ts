import { BadRequestException } from '@nestjs/common';

/** First bytes used to detect real file type (extension spoofing defense). */
const SIGNATURES: ReadonlyArray<{ mime: string; bytes: readonly number[]; offset?: number }> = [
  { mime: 'application/pdf', bytes: [0x25, 0x50, 0x44, 0x46] },
  { mime: 'image/png', bytes: [0x89, 0x50, 0x4e, 0x47] },
  { mime: 'image/jpeg', bytes: [0xff, 0xd8, 0xff] },
  { mime: 'image/webp', bytes: [0x52, 0x49, 0x46, 0x46], offset: 0 },
];

function matchesAt(buffer: Buffer, bytes: readonly number[], offset: number): boolean {
  if (buffer.length < offset + bytes.length) {
    return false;
  }
  for (let i = 0; i < bytes.length; i++) {
    if (buffer[offset + i] !== bytes[i]) {
      return false;
    }
  }
  return true;
}

export function detectBufferMime(buffer: Buffer): string | null {
  if (!buffer.length) {
    return null;
  }
  for (const sig of SIGNATURES) {
    const offset = sig.offset ?? 0;
    if (matchesAt(buffer, sig.bytes, offset)) {
      if (sig.mime === 'image/webp') {
        return buffer.length >= 12 && buffer.toString('ascii', 8, 12) === 'WEBP'
          ? 'image/webp'
          : null;
      }
      return sig.mime;
    }
  }
  return null;
}

/**
 * Validates declared MIME against magic bytes.
 * Accepts correct extension with matching content; rejects mismatched spoofing.
 */
export function assertUploadMimeMatchesMagicBytes(
  buffer: Buffer,
  declaredMime: string | undefined,
  allowed: ReadonlySet<string>,
): string {
  const declared = (declaredMime ?? '').toLowerCase().split(';')[0]?.trim() ?? '';
  if (!declared || !allowed.has(declared)) {
    throw new BadRequestException(`Allowed types: ${[...allowed].join(', ')}`);
  }
  const detected = detectBufferMime(buffer);
  if (!detected) {
    throw new BadRequestException('Could not verify file content type');
  }
  if (detected !== declared) {
    throw new BadRequestException(
      'File content does not match declared type (possible extension spoofing)',
    );
  }
  return detected;
}
