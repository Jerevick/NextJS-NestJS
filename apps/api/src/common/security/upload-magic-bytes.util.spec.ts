import { assertUploadMimeMatchesMagicBytes, detectBufferMime } from './upload-magic-bytes.util';

const ALLOWED = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/webp']);

describe('upload-magic-bytes.util', () => {
  it('detects PDF magic bytes', () => {
    const buf = Buffer.from('%PDF-1.4', 'utf8');
    expect(detectBufferMime(buf)).toBe('application/pdf');
  });

  it('accepts PNG when extension and bytes match', () => {
    const buf = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    expect(assertUploadMimeMatchesMagicBytes(buf, 'image/png', ALLOWED)).toBe('image/png');
  });

  it('rejects PDF bytes with image/png declared type', () => {
    const buf = Buffer.from('%PDF-1.4', 'utf8');
    expect(() => assertUploadMimeMatchesMagicBytes(buf, 'image/png', ALLOWED)).toThrow(
      /does not match declared type/,
    );
  });
});
