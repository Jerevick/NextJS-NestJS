import type { WebhookPlatformEvent } from '../integrations/integration.types';

/** Internal bus event — fan-out to InstitutionWebhook subscriptions. */
export const PLATFORM_WEBHOOK_DISPATCH = 'platform.webhook.dispatch';

export type PlatformWebhookDispatchPayload = {
  event: WebhookPlatformEvent;
  institutionId: string;
  entityId?: string | null;
  data: Record<string, unknown>;
  occurredAt?: string;
};
