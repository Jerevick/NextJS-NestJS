import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type {
  InitializePaymentInput,
  InitializePaymentResult,
  PaymentGateway,
} from './payment-gateway.interface';
import { FlutterwaveFinanceGateway } from './flutterwave-finance.gateway';
import { NoopFinanceGateway } from './noop-finance.gateway';
import { PaymobFinanceGateway } from './paymob-finance.gateway';
import { PaystackFinanceGateway } from './paystack-finance.gateway';
import { StripeFinanceGateway } from './stripe-finance.gateway';

type EntityPaymentSettings = {
  paymentGateway?: string;
};

@Injectable()
export class PaymentGatewayService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stripe: StripeFinanceGateway,
    private readonly flutterwave: FlutterwaveFinanceGateway,
    private readonly paystack: PaystackFinanceGateway,
    private readonly paymob: PaymobFinanceGateway,
    private readonly noop: NoopFinanceGateway,
  ) {}

  async findActiveBankIntegration(entityId: string, provider: string) {
    return this.prisma.financeBankIntegration.findFirst({
      where: {
        entityId,
        provider: provider.toLowerCase(),
        isActive: true,
      },
    });
  }

  /** Env secret first; optional per-entity FinanceBankIntegration.webhookSecret. */
  async resolveWebhookSecret(provider: string, entityId?: string): Promise<string> {
    const envMap: Record<string, string | undefined> = {
      stripe:
        process.env.FINANCE_STRIPE_WEBHOOK_SECRET?.trim() ??
        process.env.STRIPE_WEBHOOK_SECRET?.trim(),
      paystack: process.env.PAYSTACK_SECRET_KEY?.trim(),
      flutterwave:
        process.env.FLUTTERWAVE_WEBHOOK_SECRET?.trim() ??
        process.env.FLUTTERWAVE_SECRET_HASH?.trim(),
      paymob: process.env.PAYMOB_HMAC_SECRET?.trim(),
    };
    const fromEnv = envMap[provider.toLowerCase()] ?? '';
    if (fromEnv) {
      return fromEnv;
    }
    if (!entityId) {
      return '';
    }
    const row = await this.findActiveBankIntegration(entityId, provider);
    if (!row?.webhookSecret?.trim()) {
      const config =
        row?.config && typeof row.config === 'object' && !Array.isArray(row.config)
          ? (row.config as Record<string, unknown>)
          : {};
      const nested = typeof config.webhookSecret === 'string' ? config.webhookSecret.trim() : '';
      return nested;
    }
    return row.webhookSecret.trim();
  }

  resolveProvider(provider: string): PaymentGateway {
    switch (provider.toLowerCase()) {
      case 'stripe':
        return this.stripe;
      case 'flutterwave':
        return this.flutterwave;
      case 'paystack':
        return this.paystack;
      case 'paymob':
        return this.paymob;
      default:
        return this.noop;
    }
  }

  async resolveForEntity(entityId: string): Promise<PaymentGateway> {
    const entity = await this.prisma.institutionEntity.findFirst({
      where: { id: entityId, deletedAt: null },
      select: { settings: true, institutionId: true },
    });
    const settings = (entity?.settings ?? {}) as EntityPaymentSettings;
    const gw = (settings.paymentGateway ?? 'noop').toLowerCase();
    const bank = await this.findActiveBankIntegration(entityId, gw);
    if (bank && gw !== 'noop') {
      // Active bank row confirms provider is configured for settlements on this entity.
      void bank;
    }
    switch (gw) {
      case 'stripe':
        return this.stripe;
      case 'flutterwave':
        return this.flutterwave;
      case 'paystack':
        return this.paystack;
      case 'paymob':
        return this.paymob;
      default:
        return this.noop;
    }
  }

  async initialize(input: InitializePaymentInput): Promise<InitializePaymentResult> {
    const gateway = await this.resolveForEntity(input.entityId);
    return gateway.initializePayment(input);
  }

  async initiateRefund(entityId: string, reference: string, amount: number) {
    const gateway = await this.resolveForEntity(entityId);
    return gateway.initiateRefund(reference, amount);
  }

  async verifyPayment(entityId: string, reference: string) {
    const gateway = await this.resolveForEntity(entityId);
    return gateway.verifyPayment(reference);
  }
}
