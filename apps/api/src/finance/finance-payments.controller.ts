import {
  Body,
  Controller,
  Headers,
  HttpCode,
  Param,
  Post,
  RawBodyRequest,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import type { AuthUser } from '../auth/auth.types';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import type { InitiateStudentPaymentDto } from './dto/initiate-student-payment.dto';
import { FinancePaymentsWebhookService } from './finance-payments-webhook.service';
import { FinancePaymentsService } from './finance-payments.service';

@Throttle({ default: { limit: 60, ttl: 60_000 } })
@Controller('finance/payments')
export class FinancePaymentsController {
  constructor(
    private readonly payments: FinancePaymentsService,
    private readonly webhooks: FinancePaymentsWebhookService,
  ) {}

  @Post('students/:studentId/initiate')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('finance.read')
  initiate(
    @CurrentUser() user: AuthUser,
    @Param('studentId') studentId: string,
    @Body() dto: InitiateStudentPaymentDto,
  ) {
    return this.payments.initiateStudentPayment(user, studentId, dto);
  }

  @Public()
  @Post('webhooks/stripe')
  @HttpCode(200)
  stripeWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature: string | undefined,
    @Body() body: Record<string, unknown>,
  ) {
    return this.webhooks.handleStripe(req, body, signature);
  }

  @Public()
  @Post('webhooks/paystack')
  @HttpCode(200)
  paystackWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('x-paystack-signature') signature: string | undefined,
    @Body() body: Record<string, unknown>,
  ) {
    return this.webhooks.handlePaystack(req, body, signature);
  }

  @Public()
  @Post('webhooks/flutterwave')
  @HttpCode(200)
  flutterwaveWebhook(
    @Headers('verif-hash') verifHash: string | undefined,
    @Body() body: Record<string, unknown>,
  ) {
    return this.webhooks.handleFlutterwave(body, verifHash);
  }

  @Public()
  @Post('webhooks/paymob')
  @HttpCode(200)
  paymobWebhook(@Body() body: Record<string, unknown>) {
    return this.webhooks.handlePaymob(body);
  }
}
