import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { verifyPaymobHmac } from '../finance-webhook-verify.util';
import type {
  InitializePaymentInput,
  InitializePaymentResult,
  InitiateRefundResult,
  PaymentGateway,
  VerifyPaymentResult,
  WebhookHandleResult,
} from './payment-gateway.interface';

/** Paymob accept/payment key flow (REST). */
@Injectable()
export class PaymobFinanceGateway implements PaymentGateway {
  readonly provider = 'paymob' as const;
  private readonly log = new Logger(PaymobFinanceGateway.name);

  private async authToken(): Promise<string | null> {
    const apiKey = process.env.PAYMOB_API_KEY?.trim();
    if (!apiKey) {
      return null;
    }
    const res = await fetch('https://accept.paymob.com/api/auth/tokens', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ api_key: apiKey }),
    });
    if (!res.ok) {
      return null;
    }
    const body = (await res.json()) as { token?: string };
    return body.token ?? null;
  }

  async initializePayment(input: InitializePaymentInput): Promise<InitializePaymentResult> {
    const reference = `FIN-${randomUUID()}`;
    const token = await this.authToken();
    const integrationId = process.env.PAYMOB_INTEGRATION_ID?.trim();
    const iframeId = process.env.PAYMOB_IFRAME_ID?.trim();

    if (!token || !integrationId) {
      this.log.warn('PAYMOB_API_KEY or PAYMOB_INTEGRATION_ID not set');
      return { provider: 'paymob', reference, status: 'pending' };
    }

    const amountCents = Math.round(input.amount * 100);
    if (amountCents < 1) {
      throw new BadRequestException('Payment amount must be at least 0.01');
    }

    const orderRes = await fetch('https://accept.paymob.com/api/ecommerce/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        auth_token: token,
        delivery_needed: false,
        amount_cents: amountCents,
        currency: input.currency.toUpperCase(),
        merchant_order_id: reference,
        items: [{ name: input.description.slice(0, 80), amount_cents: amountCents, quantity: 1 }],
      }),
    });
    if (!orderRes.ok) {
      throw new BadRequestException('Paymob order creation failed');
    }
    const order = (await orderRes.json()) as { id?: number };

    const keyRes = await fetch('https://accept.paymob.com/api/acceptance/payment_keys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        auth_token: token,
        amount_cents: amountCents,
        expiration: 3600,
        order_id: order.id,
        billing_data: {
          email: `student-${input.studentId}@unicore.local`,
          first_name: 'Student',
          last_name: 'UniCore',
          phone_number: '0000000000',
          apartment: 'NA',
          floor: 'NA',
          street: 'NA',
          building: 'NA',
          shipping_method: 'NA',
          postal_code: 'NA',
          city: 'NA',
          country: 'NA',
          state: 'NA',
        },
        currency: input.currency.toUpperCase(),
        integration_id: Number(integrationId),
      }),
    });
    if (!keyRes.ok) {
      throw new BadRequestException('Paymob payment key failed');
    }
    const keyBody = (await keyRes.json()) as { token?: string };
    const paymentToken = keyBody.token;
    const paymentUrl =
      paymentToken && iframeId
        ? `https://accept.paymob.com/api/acceptance/iframes/${iframeId}?payment_token=${paymentToken}`
        : undefined;

    return { provider: 'paymob', reference, paymentUrl, status: 'pending' };
  }

  async verifyPayment(reference: string): Promise<VerifyPaymentResult> {
    return { status: 'pending', amount: 0, currency: 'EGP', metadata: { reference } };
  }

  async initiateRefund(reference: string, _amount: number): Promise<InitiateRefundResult> {
    throw new BadRequestException(`Paymob refunds are not automated; reference ${reference}`);
  }

  async handleWebhook(
    payload: unknown,
    context?: { webhookSecret?: string },
  ): Promise<WebhookHandleResult> {
    const body = (payload ?? {}) as Record<string, unknown>;
    const obj = (body.obj ?? body) as Record<string, unknown>;
    const hmacSecret = context?.webhookSecret?.trim() ?? '';
    const receivedHmac =
      typeof body.hmac === 'string'
        ? body.hmac
        : typeof obj.hmac === 'string'
          ? obj.hmac
          : undefined;
    if (hmacSecret && !verifyPaymobHmac(obj, receivedHmac, hmacSecret)) {
      throw new BadRequestException('Invalid Paymob webhook HMAC');
    }
    const success = obj.success === true || obj.success === 'true';
    const order =
      obj.order && typeof obj.order === 'object' && !Array.isArray(obj.order)
        ? (obj.order as Record<string, unknown>)
        : undefined;
    const finRef =
      typeof order?.merchant_order_id === 'string'
        ? order.merchant_order_id
        : typeof obj.merchant_order_id === 'string'
          ? obj.merchant_order_id
          : undefined;
    if (!success || !finRef) {
      return { ok: true, processed: false };
    }
    return { ok: true, reference: finRef, processed: false };
  }
}
