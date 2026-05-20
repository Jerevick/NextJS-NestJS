import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import Stripe from 'stripe';

export type AlumniCheckoutInput = {
  institutionId: string;
  entityId: string;
  amount: number;
  currency: string;
  description: string;
  successUrl: string;
  cancelUrl: string;
  metadata: Record<string, string>;
};

export type AlumniCheckoutResult = {
  reference: string;
  paymentUrl?: string;
  status: 'pending' | 'completed';
};

@Injectable()
export class AlumniPaymentsService {
  private readonly log = new Logger(AlumniPaymentsService.name);

  private stripeClient(): InstanceType<typeof Stripe> | null {
    const key = process.env.STRIPE_SECRET_KEY?.trim();
    if (!key) return null;
    return new Stripe(key, { apiVersion: '2026-04-22.dahlia', typescript: true });
  }

  async createCheckout(input: AlumniCheckoutInput): Promise<AlumniCheckoutResult> {
    const reference = `ALM-${randomUUID()}`;
    const amount = Number(input.amount);
    if (!Number.isFinite(amount) || amount < 0) {
      throw new BadRequestException('Invalid payment amount');
    }
    if (amount === 0) {
      return { reference, status: 'completed' };
    }

    const stripe = this.stripeClient();
    if (!stripe) {
      this.log.warn(
        'STRIPE_SECRET_KEY not set — alumni payment recorded as pending without checkout URL',
      );
      return { reference, status: 'pending' };
    }

    const unitAmount = Math.round(amount * 100);
    if (unitAmount < 1) {
      throw new BadRequestException('Payment amount must be at least 0.01');
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      success_url: input.successUrl,
      cancel_url: input.cancelUrl,
      client_reference_id: reference,
      metadata: {
        scope: 'alumni',
        reference,
        institutionId: input.institutionId,
        entityId: input.entityId,
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
      reference,
      paymentUrl: session.url ?? undefined,
      status: 'pending',
    };
  }

  async verifyReference(reference: string): Promise<'pending' | 'completed'> {
    const stripe = this.stripeClient();
    if (!stripe) return 'pending';
    const sessions = await stripe.checkout.sessions.list({ limit: 30 });
    const match = sessions.data.find(
      (s) =>
        s.client_reference_id === reference ||
        (s.metadata?.reference === reference && s.metadata?.scope === 'alumni'),
    );
    if (!match) return 'pending';
    return match.payment_status === 'paid' ? 'completed' : 'pending';
  }
}
