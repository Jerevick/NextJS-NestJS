export type IntegrationCategory =
  | 'VIDEO_CONFERENCING'
  | 'COMMUNICATION'
  | 'ACADEMIC'
  | 'CALENDAR'
  | 'PAYMENT';

export type IntegrationTestResult = {
  success: boolean;
  message: string;
};

export interface UniCoreIntegration {
  readonly code: string;
  readonly name: string;
  readonly category: IntegrationCategory;
  readonly description?: string;
  configure(
    institutionId: string,
    entityId: string | null,
    settings: Record<string, unknown>,
  ): Promise<void>;
  test(institutionId: string, entityId: string | null): Promise<IntegrationTestResult>;
  disable(institutionId: string, entityId: string | null): Promise<void>;
}

export type MarketplaceIntegrationMeta = {
  code: string;
  name: string;
  category: IntegrationCategory;
  description: string;
  enabled: boolean;
  configured: boolean;
  configuredAt: string | null;
};

export const WEBHOOK_PLATFORM_EVENTS = [
  'student.enrolled',
  'grade.released',
  'payment.received',
  'student.status_changed',
  'workflow.completed',
  'enrollment.created',
] as const;

export type WebhookPlatformEvent = (typeof WEBHOOK_PLATFORM_EVENTS)[number];

export type WebhookDispatchJob = {
  deliveryId: string;
  webhookId: string;
  institutionId: string;
  url: string;
  secret: string;
  event: string;
  payload: Record<string, unknown>;
  attempt: number;
};

export const PUBLIC_API_KEY_PREFIX = 'uc_live_';
