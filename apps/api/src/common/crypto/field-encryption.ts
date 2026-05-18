import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';

const ALGO = 'aes-256-gcm';
const SALT = 'unicore-field-salt-v1';

export type EncryptedFieldPayload = {
  _enc: true;
  v: 1;
  payload: string;
};

function resolveKey(): Buffer {
  const secret = process.env.FIELD_ENCRYPTION_KEY ?? process.env.JWT_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error(
      'FIELD_ENCRYPTION_KEY (or JWT_SECRET ≥16 chars) is required for sensitive field encryption',
    );
  }
  return scryptSync(secret, SALT, 32);
}

export function isEncryptedField(value: unknown): value is EncryptedFieldPayload {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as EncryptedFieldPayload)._enc === true &&
    typeof (value as EncryptedFieldPayload).payload === 'string'
  );
}

/** Encrypt a JSON-serializable value for storage in Prisma Json columns. */
export function encryptSensitiveJson(value: unknown): EncryptedFieldPayload {
  const key = resolveKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, key, iv);
  const plaintext = JSON.stringify(value);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  const packed = Buffer.concat([iv, tag, ciphertext]).toString('base64');
  return { _enc: true, v: 1, payload: packed };
}

/** Decrypt a stored encrypted field; returns null if missing or invalid. */
export function decryptSensitiveJson(stored: unknown): unknown | null {
  if (stored == null) return null;
  if (!isEncryptedField(stored)) {
    return typeof stored === 'object' ? stored : null;
  }
  try {
    const key = resolveKey();
    const raw = Buffer.from(stored.payload, 'base64');
    const iv = raw.subarray(0, 12);
    const tag = raw.subarray(12, 28);
    const ciphertext = raw.subarray(28);
    const decipher = createDecipheriv(ALGO, key, iv);
    decipher.setAuthTag(tag);
    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString(
      'utf8',
    );
    return JSON.parse(plaintext) as unknown;
  } catch {
    return null;
  }
}
