import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { ENROLLMENT_CREATED, type EnrollmentCreatedEvent } from '../events/enrollment.events';
import {
  PLATFORM_WEBHOOK_DISPATCH,
  type PlatformWebhookDispatchPayload,
} from '../events/platform-webhook.events';
import { WebhooksService } from './webhooks.service';

@Injectable()
export class WebhookEventsListener {
  private readonly log = new Logger(WebhookEventsListener.name);

  constructor(private readonly webhooks: WebhooksService) {}

  @OnEvent(PLATFORM_WEBHOOK_DISPATCH, { async: true })
  async onPlatformWebhook(payload: PlatformWebhookDispatchPayload): Promise<void> {
    try {
      await this.webhooks.emitPlatformEvent(
        payload.institutionId,
        payload.event,
        {
          ...payload.data,
          occurredAt: payload.occurredAt ?? new Date().toISOString(),
        },
        payload.entityId,
      );
    } catch (err) {
      this.log.warn(
        `Webhook dispatch failed for ${payload.event}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  /** Backward-compatible: finance and other modules still listen to enrollment.created. */
  @OnEvent(ENROLLMENT_CREATED, { async: true })
  async onEnrollmentCreated(payload: EnrollmentCreatedEvent): Promise<void> {
    await this.onPlatformWebhook({
      event: 'enrollment.created',
      institutionId: payload.institutionId,
      entityId: payload.entityId,
      data: {
        studentId: payload.studentId,
        enrollmentId: payload.enrollmentId,
        programId: payload.programId,
        semesterId: payload.semesterId,
        courseCode: payload.courseCode,
      },
    });
    await this.onPlatformWebhook({
      event: 'student.enrolled',
      institutionId: payload.institutionId,
      entityId: payload.entityId,
      data: {
        studentId: payload.studentId,
        enrollmentId: payload.enrollmentId,
      },
    });
  }
}
