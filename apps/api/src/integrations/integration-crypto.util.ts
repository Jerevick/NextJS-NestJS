import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

export function hashApiKey(fullKey: string): string {
  return createHash('sha256').update(fullKey, 'utf8').digest('hex');
}

export function generateApiKeyPair(prefix: string): {
  lookup: string;
  fullKey: string;
  hash: string;
} {
  const lookup = randomBytes(8).toString('hex');
  const secret = randomBytes(24).toString('hex');
  const fullKey = `${prefix}${lookup}.${secret}`;
  return { lookup, fullKey, hash: hashApiKey(fullKey) };
}

export function verifyApiKey(fullKey: string, expectedHash: string): boolean {
  const hash = hashApiKey(fullKey);
  try {
    return timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(expectedHash, 'hex'));
  } catch {
    return false;
  }
}

export function signWebhookPayload(secret: string, body: string, timestamp: number): string {
  const signed = `${timestamp}.${body}`;
  return createHmac('sha256', secret).update(signed, 'utf8').digest('hex');
}

const WEBHOOK_MAX_SKEW_SEC = 300;

/** Verify inbound `X-Webhook-Signature` header (`t=<unix>,v1=<hex>`). */
export function verifyWebhookPayload(
  secret: string,
  body: string,
  signatureHeader: string | undefined,
  nowSec = Math.floor(Date.now() / 1000),
): boolean {
  if (!signatureHeader?.trim() || !secret.trim()) {
    return false;
  }
  const parts = Object.fromEntries(
    signatureHeader.split(',').map((p) => {
      const [k, v] = p.trim().split('=');
      return [k, v ?? ''];
    }),
  );
  const ts = Number(parts.t);
  const v1 = parts.v1;
  if (!Number.isFinite(ts) || !v1) {
    return false;
  }
  if (Math.abs(nowSec - ts) > WEBHOOK_MAX_SKEW_SEC) {
    return false;
  }
  const expected = signWebhookPayload(secret, body, ts);
  try {
    return timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(v1, 'hex'));
  } catch {
    return false;
  }
}
