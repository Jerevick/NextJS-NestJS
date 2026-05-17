import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { verifyFlutterwaveHash } from '../finance-webhook-verify.util';
import type {
  InitializePaymentInput,
  InitializePaymentResult,
  InitiateRefundResult,
  PaymentGateway,
  VerifyPaymentResult,
  WebhookHandleResult,
} from './payment-gateway.interface';

@Injectable()
export class FlutterwaveFinanceGateway implements PaymentGateway {
  readonly provider = 'flutterwave' as const;
  private readonly log = new Logger(FlutterwaveFinanceGateway.name);

  private secretKey() {
    return process.env.FLUTTERWAVE_SECRET_KEY?.trim() ?? '';
  }

  async initializePayment(input: InitializePaymentInput): Promise<InitializePaymentResult> {
    const key = this.secretKey();
    const reference = `FIN-${randomUUID()}`;
    if (!key) {
      this.log.warn('FLUTTERWAVE_SECRET_KEY not set');
      return { provider: 'flutterwave', reference, status: 'pending' };
    }

    const res = await fetch('https://api.flutterwave.com/v3/payments', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        tx_ref: reference,
        amount: input.amount,
        currency: input.currency.toUpperCase(),
        redirect_url: input.successUrl,
        customer: {
          email: `student-${input.studentId}@unicore.local`,
          name: 'Student',
        },
        meta: {
          scope: 'student_finance',
          reference,
          institutionId: input.institutionId,
          entityId: input.entityId,
          studentId: input.studentId,
          studentAccountId: input.studentAccountId,
          ...input.metadata,
        },
        customizations: {
          title: 'UniCore',
          description: input.description.slice(0, 120),
        },
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new BadRequestException(`Flutterwave initialize failed: ${text.slice(0, 200)}`);
    }

    const body = (await res.json()) as {
      status?: string;
      data?: { link?: string };
    };
    if (body.status !== 'success') {
      throw new BadRequestException('Flutterwave did not return a payment link');
    }

    return {
      provider: 'flutterwave',
      reference,
      paymentUrl: body.data?.link,
      status: 'pending',
    };
  }

  async verifyPayment(reference: string): Promise<VerifyPaymentResult> {
    const key = this.secretKey();
    if (!key) {
      return { status: 'pending', amount: 0, currency: 'USD', metadata: { reference } };
    }

    const q = new URLSearchParams({ tx_ref: reference });
    const res = await fetch(
      `https://api.flutterwave.com/v3/transactions/verify_by_reference?${q}`,
      {
        headers: { Authorization: `Bearer ${key}` },
      },
    );
    if (!res.ok) {
      return { status: 'failed', amount: 0, currency: 'USD', metadata: { reference } };
    }

    const body = (await res.json()) as {
      data?: { status?: string; amount?: number; currency?: string; meta?: Record<string, string> };
    };
    const data = body.data;
    const completed = data?.status === 'successful';
    return {
      status: completed ? 'completed' : 'pending',
      amount: data?.amount ?? 0,
      currency: (data?.currency ?? 'USD').toUpperCase(),
      metadata: { ...(data?.meta ?? {}), reference },
    };
  }

  async initiateRefund(reference: string, amount: number): Promise<InitiateRefundResult> {
    const key = this.secretKey();
    if (!key) {
      throw new BadRequestException('FLUTTERWAVE_SECRET_KEY not configured');
    }
    const res = await fetch('https://api.flutterwave.com/v3/transactions/refund', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ tx_ref: reference, amount }),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new BadRequestException(`Flutterwave refund failed: ${text.slice(0, 200)}`);
    }
    const body = (await res.json()) as { data?: { id?: number; status?: string } };
    return {
      refundRef: String(body.data?.id ?? reference),
      status: body.data?.status === 'completed' ? 'completed' : 'pending',
    };
  }

  async handleWebhook(
    payload: unknown,
    context?: {
      headers?: Record<string, string | string[] | undefined>;
      webhookSecret?: string;
    },
  ): Promise<WebhookHandleResult> {
    const body = (payload ?? {}) as Record<string, unknown>;
    const secret = context?.webhookSecret?.trim() ?? '';
    const verifHash =
      typeof context?.headers?.['verif-hash'] === 'string'
        ? context.headers['verif-hash']
        : undefined;
    if (secret && !verifyFlutterwaveHash(verifHash, secret)) {
      throw new BadRequestException('Invalid Flutterwave webhook hash');
    }
    const event = typeof body.event === 'string' ? body.event : '';
    const data = body.data as { status?: string; tx_ref?: string } | undefined;
    if (event !== 'charge.completed' || data?.status !== 'successful' || !data?.tx_ref) {
      return { ok: true, processed: false, eventType: event };
    }
    return { ok: true, reference: data.tx_ref, eventType: event, processed: false };
  }
}
