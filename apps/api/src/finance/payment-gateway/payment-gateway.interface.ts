export type PaymentGatewayProvider = 'stripe' | 'flutterwave' | 'paystack' | 'paymob' | 'noop';

export type InitializePaymentInput = {
  institutionId: string;
  entityId: string;
  studentId: string;
  studentAccountId: string;
  amount: number;
  currency: string;
  description: string;
  successUrl: string;
  cancelUrl: string;
  metadata?: Record<string, string>;
};

export type InitializePaymentResult = {
  provider: PaymentGatewayProvider;
  reference: string;
  paymentUrl?: string;
  status: 'pending' | 'completed' | 'failed';
};

export type VerifyPaymentResult = {
  status: 'pending' | 'completed' | 'failed';
  amount: number;
  currency: string;
  metadata: Record<string, string>;
};

export type InitiateRefundResult = {
  refundRef: string;
  status: 'pending' | 'completed' | 'failed';
};

export type WebhookHandleResult = {
  ok: boolean;
  reference?: string;
  eventType?: string;
  processed?: boolean;
};

export interface PaymentGateway {
  readonly provider: PaymentGatewayProvider;
  initializePayment(input: InitializePaymentInput): Promise<InitializePaymentResult>;
  verifyPayment(reference: string): Promise<VerifyPaymentResult>;
  initiateRefund(reference: string, amount: number): Promise<InitiateRefundResult>;
  /**
   * Optional provider webhook handler. UniCore finance webhooks are verified and routed in
   * `FinancePaymentsController`; gateways may implement this for tests or future consolidation.
   */
  handleWebhook?(
    payload: unknown,
    context?: {
      rawBody?: Buffer;
      headers?: Record<string, string | string[] | undefined>;
      webhookSecret?: string;
    },
  ): Promise<WebhookHandleResult>;
}
