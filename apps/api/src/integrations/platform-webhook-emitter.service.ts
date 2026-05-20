import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  PLATFORM_WEBHOOK_DISPATCH,
  type PlatformWebhookDispatchPayload,
} from '../events/platform-webhook.events';
import type { WebhookPlatformEvent } from './integration.types';

@Injectable()
export class PlatformWebhookEmitter {
  constructor(private readonly events: EventEmitter2) {}

  dispatch(
    event: WebhookPlatformEvent,
    institutionId: string,
    data: Record<string, unknown>,
    entityId?: string | null,
  ): void {
    const payload: PlatformWebhookDispatchPayload = {
      event,
      institutionId,
      entityId: entityId ?? null,
      data,
      occurredAt: new Date().toISOString(),
    };
    this.events.emit(PLATFORM_WEBHOOK_DISPATCH, payload);
  }
}
