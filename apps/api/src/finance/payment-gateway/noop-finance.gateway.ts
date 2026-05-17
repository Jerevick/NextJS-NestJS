import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type {
  InitializePaymentInput,
  InitializePaymentResult,
  InitiateRefundResult,
  PaymentGateway,
  VerifyPaymentResult,
} from './payment-gateway.interface';

@Injectable()
export class NoopFinanceGateway implements PaymentGateway {
  readonly provider = 'noop' as const;

  async initializePayment(_input: InitializePaymentInput): Promise<InitializePaymentResult> {
    return {
      provider: 'noop',
      reference: `NOOP-${randomUUID()}`,
      status: 'pending',
    };
  }

  async verifyPayment(reference: string): Promise<VerifyPaymentResult> {
    return { status: 'pending', amount: 0, currency: 'USD', metadata: { reference } };
  }

  async initiateRefund(reference: string, _amount: number): Promise<InitiateRefundResult> {
    return { refundRef: `NOOP-REF-${reference}`, status: 'pending' };
  }
}
