import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import Stripe from 'stripe';
import type {
  InitializePaymentInput,
  InitializePaymentResult,
  InitiateRefundResult,
  PaymentGateway,
  VerifyPaymentResult,
  WebhookHandleResult,
} from './payment-gateway.interface';

@Injectable()
export class StripeFinanceGateway implements PaymentGateway {
  readonly provider = 'stripe' as const;
  private readonly log = new Logger(StripeFinanceGateway.name);

  private client() {
    const key = process.env.STRIPE_SECRET_KEY?.trim();
    if (!key) {
      return null;
    }
    return new Stripe(key, {
      apiVersion: '2026-04-22.dahlia',
      typescript: true,
    });
  }

  async initializePayment(input: InitializePaymentInput): Promise<InitializePaymentResult> {
    const stripe = this.client();
    const reference = `FIN-${randomUUID()}`;
    if (!stripe) {
      this.log.warn('STRIPE_SECRET_KEY not set — returning pending reference without checkout URL');
      return { provider: 'stripe', reference, status: 'pending' };
    }

    const unitAmount = Math.round(input.amount * 100);
    if (unitAmount < 1) {
      throw new BadRequestException('Payment amount must be at least 0.01');
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      success_url: input.successUrl,
      cancel_url: input.cancelUrl,
      client_reference_id: reference,
      metadata: {
        scope: 'student_finance',
        reference,
        institutionId: input.institutionId,
        entityId: input.entityId,
        studentId: input.studentId,
        studentAccountId: input.studentAccountId,
        ...input.metadata,
      },
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: input.currency.toLowerCase(),
            unit_amount: unitAmount,
            product_data: { name: input.description.slice(0, 120) },
          },
        },
      ],
    });

    return {
      provider: 'stripe',
      reference,
      paymentUrl: session.url ?? undefined,
      status: 'pending',
    };
  }

  async verifyPayment(reference: string): Promise<VerifyPaymentResult> {
    const stripe = this.client();
    if (!stripe) {
      return { status: 'pending', amount: 0, currency: 'USD', metadata: { reference } };
    }

    const sessions = await stripe.checkout.sessions.list({ limit: 20 });
    const match = sessions.data.find(
      (s) => s.client_reference_id === reference || s.metadata?.reference === reference,
    );
    if (!match) {
      return { status: 'pending', amount: 0, currency: 'USD', metadata: { reference } };
    }

    const amount = (match.amount_total ?? 0) / 100;
    const currency = (match.currency ?? 'usd').toUpperCase();
    const completed = match.payment_status === 'paid';
    return {
      status: completed ? 'completed' : 'pending',
      amount,
      currency,
      metadata: { ...(match.metadata ?? {}), reference },
    };
  }

  async initiateRefund(reference: string, amount: number): Promise<InitiateRefundResult> {
    const stripe = this.client();
    if (!stripe) {
      throw new BadRequestException('STRIPE_SECRET_KEY not configured');
    }
    const sessions = await stripe.checkout.sessions.list({ limit: 30 });
    const match = sessions.data.find(
      (s) => s.client_reference_id === reference || s.metadata?.reference === reference,
    );
    const paymentIntentId =
      typeof match?.payment_intent === 'string'
        ? match.payment_intent
        : match?.payment_intent && typeof match.payment_intent === 'object'
          ? match.payment_intent.id
          : undefined;
    if (!paymentIntentId) {
      throw new BadRequestException('No Stripe payment intent found for reference');
    }
    const refund = await stripe.refunds.create({
      payment_intent: paymentIntentId,
      amount: Math.round(amount * 100),
    });
    return {
      refundRef: refund.id,
      status: refund.status === 'succeeded' ? 'completed' : 'pending',
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
    const signature =
      typeof context?.headers?.['stripe-signature'] === 'string'
        ? context.headers['stripe-signature']
        : undefined;
    const webhookSecret = context?.webhookSecret?.trim() ?? '';

    let eventType = typeof body.type === 'string' ? body.type : '';
    let reference: string | undefined;
    let metadata: Record<string, string> = {};

    if (webhookSecret && signature) {
      const apiKey = process.env.STRIPE_SECRET_KEY?.trim();
      if (!apiKey) {
        throw new BadRequestException('STRIPE_SECRET_KEY required for webhook verification');
      }
      const raw = context?.rawBody;
      if (!Buffer.isBuffer(raw)) {
        throw new BadRequestException('Raw body required for Stripe webhook verification');
      }
      const stripe = new Stripe(apiKey, {
        apiVersion: '2026-04-22.dahlia',
        typescript: true,
      });
      const event = stripe.webhooks.constructEvent(raw, signature, webhookSecret);
      eventType = event.type;
      if (event.type === 'checkout.session.completed') {
        const session = event.data.object;
        reference =
          session.client_reference_id ??
          (typeof session.metadata?.reference === 'string'
            ? session.metadata.reference
            : undefined);
        metadata = (session.metadata ?? {}) as Record<string, string>;
      }
    } else if (!webhookSecret && eventType === 'checkout.session.completed') {
      const data = body.data as { object?: Record<string, unknown> } | undefined;
      const session = data?.object;
      reference =
        typeof session?.client_reference_id === 'string' ? session.client_reference_id : undefined;
      const meta = session?.metadata;
      if (meta && typeof meta === 'object') {
        metadata = meta as Record<string, string>;
        if (!reference && typeof metadata.reference === 'string') {
          reference = metadata.reference;
        }
      }
    }

    if (eventType !== 'checkout.session.completed' || !reference) {
      return { ok: true, processed: false, eventType };
    }
    if (metadata.scope && metadata.scope !== 'student_finance') {
      return { ok: true, processed: false, eventType, reference };
    }
    return { ok: true, reference, eventType, processed: false };
  }
}
