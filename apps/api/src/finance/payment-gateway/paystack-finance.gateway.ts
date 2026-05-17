import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { verifyPaystackSignature } from '../finance-webhook-verify.util';
import type {
  InitializePaymentInput,
  InitializePaymentResult,
  InitiateRefundResult,
  PaymentGateway,
  VerifyPaymentResult,
  WebhookHandleResult,
} from './payment-gateway.interface';

@Injectable()
export class PaystackFinanceGateway implements PaymentGateway {
  readonly provider = 'paystack' as const;
  private readonly log = new Logger(PaystackFinanceGateway.name);

  private secretKey() {
    return process.env.PAYSTACK_SECRET_KEY?.trim() ?? '';
  }

  async initializePayment(input: InitializePaymentInput): Promise<InitializePaymentResult> {
    const key = this.secretKey();
    const reference = `FIN-${randomUUID()}`;
    if (!key) {
      this.log.warn('PAYSTACK_SECRET_KEY not set');
      return { provider: 'paystack', reference, status: 'pending' };
    }

    const amountKobo = Math.round(input.amount * 100);
    if (amountKobo < 1) {
      throw new BadRequestException('Payment amount must be at least 0.01');
    }

    const res = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: amountKobo,
        email: `student-${input.studentId}@unicore.local`,
        currency: input.currency.toUpperCase(),
        reference,
        callback_url: input.successUrl,
        metadata: {
          scope: 'student_finance',
          reference,
          institutionId: input.institutionId,
          entityId: input.entityId,
          studentId: input.studentId,
          studentAccountId: input.studentAccountId,
          cancel_action: input.cancelUrl,
          ...input.metadata,
        },
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new BadRequestException(`Paystack initialize failed: ${text.slice(0, 200)}`);
    }

    const body = (await res.json()) as {
      status?: boolean;
      data?: { authorization_url?: string; reference?: string };
    };
    return {
      provider: 'paystack',
      reference: body.data?.reference ?? reference,
      paymentUrl: body.data?.authorization_url,
      status: 'pending',
    };
  }

  async verifyPayment(reference: string): Promise<VerifyPaymentResult> {
    const key = this.secretKey();
    if (!key) {
      return { status: 'pending', amount: 0, currency: 'NGN', metadata: { reference } };
    }

    const res = await fetch(
      `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
      { headers: { Authorization: `Bearer ${key}` } },
    );
    if (!res.ok) {
      return { status: 'failed', amount: 0, currency: 'NGN', metadata: { reference } };
    }

    const body = (await res.json()) as {
      data?: {
        status?: string;
        amount?: number;
        currency?: string;
        metadata?: Record<string, string>;
      };
    };
    const data = body.data;
    const amount = (data?.amount ?? 0) / 100;
    const currency = (data?.currency ?? 'NGN').toUpperCase();
    const completed = data?.status === 'success';
    return {
      status: completed ? 'completed' : data?.status === 'failed' ? 'failed' : 'pending',
      amount,
      currency,
      metadata: { ...(data?.metadata ?? {}), reference },
    };
  }

  async initiateRefund(reference: string, amount: number): Promise<InitiateRefundResult> {
    const key = this.secretKey();
    if (!key) {
      throw new BadRequestException('PAYSTACK_SECRET_KEY not configured');
    }
    const amountKobo = Math.round(amount * 100);
    const res = await fetch('https://api.paystack.co/refund', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ transaction: reference, amount: amountKobo }),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new BadRequestException(`Paystack refund failed: ${text.slice(0, 200)}`);
    }
    const body = (await res.json()) as { data?: { id?: number; status?: string } };
    return {
      refundRef: String(body.data?.id ?? reference),
      status: body.data?.status === 'processed' ? 'completed' : 'pending',
    };
  }

  async handleWebhook(
    payload: unknown,
    context?: {
      rawBody?: Buffer;
      headers?: Record<string, string | string[] | undefined>;
      webhookSecret?: string;
    },
  ): Promise<WebhookHandleResult> {
    const body = (payload ?? {}) as Record<string, unknown>;
    const secret = context?.webhookSecret?.trim() ?? '';
    const signature =
      typeof context?.headers?.['x-paystack-signature'] === 'string'
        ? context.headers['x-paystack-signature']
        : undefined;
    if (secret) {
      const raw = context?.rawBody;
      if (!Buffer.isBuffer(raw) || !verifyPaystackSignature(raw, signature, secret)) {
        throw new BadRequestException('Invalid Paystack webhook signature');
      }
    }
    const event = typeof body.event === 'string' ? body.event : '';
    if (event !== 'charge.success') {
      return { ok: true, processed: false, eventType: event };
    }
    const data = body.data as { reference?: string; metadata?: Record<string, string> } | undefined;
    const reference =
      typeof data?.reference === 'string'
        ? data.reference
        : typeof data?.metadata?.reference === 'string'
          ? data.metadata.reference
          : undefined;
    return { ok: true, reference, eventType: event, processed: false };
  }
}
