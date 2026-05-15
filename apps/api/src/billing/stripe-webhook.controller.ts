import {
  BadRequestException,
  Body,
  Controller,
  Headers,
  HttpCode,
  Post,
  RawBodyRequest,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import Stripe from 'stripe';
import { Public } from '../common/decorators/public.decorator';

/**
 * Stripe webhook entrypoint.
 * - Without STRIPE_WEBHOOK_SECRET: accepts JSON for local wiring (not for production).
 * - With secret: verifies Stripe-Signature using raw body (Nest `rawBody: true` in main.ts).
 *   STRIPE_SECRET_KEY must also be set so the Stripe client can run webhook verification.
 */
@Controller('billing/webhooks')
export class StripeWebhookController {
  @Public()
  @Post('stripe')
  @HttpCode(200)
  stripe(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature: string | undefined,
    @Body() body: Record<string, unknown>,
  ) {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
    if (!webhookSecret) {
      return {
        received: true,
        mode: 'dev_no_secret',
        eventType: typeof body.type === 'string' ? body.type : 'unknown',
      };
    }

    if (!signature) {
      throw new BadRequestException('Missing Stripe-Signature header');
    }

    const apiKey = process.env.STRIPE_SECRET_KEY?.trim();
    if (!apiKey) {
      throw new BadRequestException(
        'STRIPE_SECRET_KEY is required when STRIPE_WEBHOOK_SECRET is set (used only for webhook signature verification)',
      );
    }

    const raw = req.rawBody;
    if (!Buffer.isBuffer(raw)) {
      throw new BadRequestException(
        'Raw request body is missing; ensure NestFactory.create(AppModule, { rawBody: true })',
      );
    }

    const stripe = new Stripe(apiKey, {
      apiVersion: '2026-04-22.dahlia',
      typescript: true,
    });

    let event;
    try {
      event = stripe.webhooks.constructEvent(raw, signature, webhookSecret);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Invalid Stripe webhook signature';
      throw new BadRequestException(msg);
    }

    return {
      received: true,
      verified: true,
      id: event.id,
      eventType: event.type,
    };
  }
}
