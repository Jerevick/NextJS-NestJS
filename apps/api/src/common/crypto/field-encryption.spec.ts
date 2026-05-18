import { decryptSensitiveJson, encryptSensitiveJson } from './field-encryption';

describe('field-encryption', () => {
  const prev = process.env.FIELD_ENCRYPTION_KEY;

  beforeAll(() => {
    process.env.FIELD_ENCRYPTION_KEY = 'test-field-encryption-key-32chars!!';
  });

  afterAll(() => {
    if (prev === undefined) delete process.env.FIELD_ENCRYPTION_KEY;
    else process.env.FIELD_ENCRYPTION_KEY = prev;
  });

  it('round-trips salary-shaped payloads', () => {
    const plain = { amount: 125000, currency: 'USD', effectiveDate: '2025-01-01' };
    const enc = encryptSensitiveJson(plain);
    expect(enc._enc).toBe(true);
    expect(decryptSensitiveJson(enc)).toEqual(plain);
  });
});
