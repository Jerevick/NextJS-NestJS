import { BadRequestException, Injectable } from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { PaymentGatewayService } from './payment-gateway/payment-gateway.service';
import { FinancePaymentsService } from './finance-payments.service';
import { assertWebhookVerificationConfigured } from './finance-webhook-verify.util';

@Injectable()
export class FinancePaymentsWebhookService {
  constructor(
    private readonly gateways: PaymentGatewayService,
    private readonly payments: FinancePaymentsService,
  ) {}

  async handleStripe(
    req: RawBodyRequest<Request>,
    body: Record<string, unknown>,
    signature: string | undefined,
  ) {
    const webhookSecret = await this.gateways.resolveWebhookSecret('stripe');
    assertWebhookVerificationConfigured('Stripe', Boolean(webhookSecret));
    const gateway = await this.gateways.resolveProvider('stripe');
    if (!gateway.handleWebhook) {
      throw new BadRequestException('Stripe gateway does not support webhooks');
    }
    const result = await gateway.handleWebhook(body, {
      rawBody: req.rawBody,
      headers: { 'stripe-signature': signature },
      webhookSecret,
    });
    if (!result.reference) {
      return { received: true, processed: false, eventType: result.eventType };
    }
    const completed = await this.payments.completeGatewayPayment(result.reference, body as never);
    return { received: true, processed: completed.ok, ...completed, ...result };
  }

  async handlePaystack(
    req: RawBodyRequest<Request>,
    body: Record<string, unknown>,
    signature: string | undefined,
  ) {
    const secret = await this.gateways.resolveWebhookSecret('paystack');
    assertWebhookVerificationConfigured('Paystack', Boolean(secret));
    const gateway = await this.gateways.resolveProvider('paystack');
    if (!gateway.handleWebhook) {
      throw new BadRequestException('Paystack gateway does not support webhooks');
    }
    const result = await gateway.handleWebhook(body, {
      rawBody: req.rawBody,
      headers: { 'x-paystack-signature': signature },
      webhookSecret: secret,
    });
    if (!result.reference) {
      return { received: true, processed: false, event: result.eventType };
    }
    const completed = await this.payments.completeGatewayPayment(result.reference, body as never);
    return { received: true, processed: completed.ok, ...completed };
  }

  async handleFlutterwave(body: Record<string, unknown>, verifHash: string | undefined) {
    const secret = await this.gateways.resolveWebhookSecret('flutterwave');
    assertWebhookVerificationConfigured('Flutterwave', Boolean(secret));
    const gateway = await this.gateways.resolveProvider('flutterwave');
    if (!gateway.handleWebhook) {
      throw new BadRequestException('Flutterwave gateway does not support webhooks');
    }
    const result = await gateway.handleWebhook(body, {
      headers: { 'verif-hash': verifHash },
      webhookSecret: secret,
    });
    if (!result.reference) {
      return { received: true, processed: false, event: result.eventType };
    }
    const completed = await this.payments.completeGatewayPayment(result.reference, body as never);
    return { received: true, processed: completed.ok, ...completed };
  }

  async handlePaymob(body: Record<string, unknown>) {
    const secret = await this.gateways.resolveWebhookSecret('paymob');
    assertWebhookVerificationConfigured('Paymob', Boolean(secret));
    const gateway = await this.gateways.resolveProvider('paymob');
    if (!gateway.handleWebhook) {
      throw new BadRequestException('Paymob gateway does not support webhooks');
    }
    const result = await gateway.handleWebhook(body, { webhookSecret: secret });
    if (!result.reference) {
      return { received: true, processed: false };
    }
    const completed = await this.payments.completeGatewayPayment(result.reference, body as never);
    return { received: true, processed: completed.ok, ...completed };
  }
}
