import { BadRequestException } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'node:crypto';

export function isProductionFinance(): boolean {
  return process.env.NODE_ENV === 'production';
}

/** In production, webhook endpoints must verify signatures — no unsigned fallback. */
export function assertWebhookVerificationConfigured(
  provider: string,
  secretConfigured: boolean,
): void {
  if (isProductionFinance() && !secretConfigured) {
    throw new BadRequestException(
      `${provider} webhook verification secret is required in production`,
    );
  }
}

/** Paystack: HMAC SHA512 of raw body with secret key. */
export function verifyPaystackSignature(
  rawBody: string | Buffer,
  signature: string | undefined,
  secret: string,
): boolean {
  if (!signature?.trim() || !secret.trim()) {
    return false;
  }
  const hash = createHmac('sha512', secret).update(rawBody).digest('hex');
  try {
    return timingSafeEqual(Buffer.from(hash), Buffer.from(signature.trim()));
  } catch {
    return false;
  }
}

/** Flutterwave: `verif-hash` header must match secret. */
export function verifyFlutterwaveHash(verifHash: string | undefined, secret: string): boolean {
  if (!verifHash?.trim() || !secret.trim()) {
    return false;
  }
  try {
    return timingSafeEqual(Buffer.from(verifHash.trim()), Buffer.from(secret.trim()));
  } catch {
    return false;
  }
}

/** Paymob: HMAC SHA256 of concatenated amount_cents + created_at + id + integration_id + order_id. */
export function verifyPaymobHmac(
  obj: Record<string, unknown>,
  receivedHmac: string | undefined,
  secret: string,
): boolean {
  if (!receivedHmac?.trim() || !secret.trim()) {
    return false;
  }
  const amount = obj.amount_cents ?? obj.amount;
  const createdAt = obj.created_at;
  const id = obj.id;
  const integrationId = obj.integration_id;
  const order =
    obj.order && typeof obj.order === 'object' && !Array.isArray(obj.order)
      ? (obj.order as Record<string, unknown>)
      : undefined;
  const orderId = order?.id ?? obj.order_id;
  const payload = `${amount}${createdAt}${id}${integrationId}${orderId}`;
  const hash = createHmac('sha256', secret).update(payload).digest('hex');
  try {
    return timingSafeEqual(Buffer.from(hash), Buffer.from(receivedHmac.trim()));
  } catch {
    return false;
  }
}
