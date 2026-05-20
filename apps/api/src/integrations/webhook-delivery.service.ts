import { Injectable, Logger, Optional } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import { WEBHOOK_DELIVERY_QUEUE } from '../queues/queue.constants';
import type { WebhookDispatchJob } from './integration.types';
import { signWebhookPayload } from './integration-crypto.util';
import { IntegrationsRepository } from './integrations.repository';

const MAX_ATTEMPTS = 5;

@Injectable()
export class WebhookDeliveryService {
  private readonly log = new Logger(WebhookDeliveryService.name);

  constructor(
    private readonly repo: IntegrationsRepository,
    @Optional()
    @InjectQueue(WEBHOOK_DELIVERY_QUEUE)
    private readonly queue?: Queue<WebhookDispatchJob>,
  ) {}

  samplePayload(event: string): Record<string, unknown> {
    return {
      id: `evt_test_${Date.now()}`,
      test: true,
      event,
      timestamp: new Date().toISOString(),
      data: { message: 'UniCore webhook test delivery' },
    };
  }

  buildEnvelope(
    event: string,
    institutionId: string,
    entityId: string | null | undefined,
    data: Record<string, unknown>,
  ): Record<string, unknown> {
    return {
      id: `evt_${Date.now()}`,
      event,
      institutionId,
      entityId: entityId ?? null,
      createdAt: new Date().toISOString(),
      data,
    };
  }

  async enqueueDelivery(input: Omit<WebhookDispatchJob, 'deliveryId'>): Promise<string> {
    const delivery = await this.repo.createDelivery({
      webhookId: input.webhookId,
      institutionId: input.institutionId,
      event: input.event,
      payload: input.payload,
      attempt: input.attempt,
    });
    const job: WebhookDispatchJob = { ...input, deliveryId: delivery.id };

    if (this.queue) {
      const delayMs = input.attempt > 1 ? Math.min(5_000 * 2 ** (input.attempt - 2), 300_000) : 0;
      await this.queue.add('deliver', job, {
        attempts: 1,
        delay: delayMs,
        removeOnComplete: 200,
        removeOnFail: 500,
        jobId: `${delivery.id}:${input.attempt}`,
      });
      return delivery.id;
    }

    await this.deliver(job);
    return delivery.id;
  }

  async deliver(job: WebhookDispatchJob): Promise<void> {
    const body = JSON.stringify(job.payload);
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = signWebhookPayload(job.secret, body, timestamp);

    let statusCode: number | null = null;
    let responseBody: string | null = null;
    let success = false;
    let errorMessage: string | null = null;

    try {
      const res = await fetch(job.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'UniCore-Webhooks/1.0',
          'X-UniCore-Event': job.event,
          'X-UniCore-Delivery-Id': job.deliveryId,
          'X-UniCore-Timestamp': String(timestamp),
          'X-UniCore-Signature': `sha256=${signature}`,
        },
        body,
        signal: AbortSignal.timeout(15_000),
      });
      statusCode = res.status;
      responseBody = (await res.text()).slice(0, 4000);
      success = res.ok;
      if (!success) {
        errorMessage = `HTTP ${res.status}`;
      }
    } catch (err) {
      errorMessage = err instanceof Error ? err.message : String(err);
    }

    await this.repo.updateDelivery(job.deliveryId, {
      statusCode,
      responseBody,
      success,
      errorMessage,
    });

    if (!success && job.attempt < MAX_ATTEMPTS) {
      await this.enqueueDelivery({
        webhookId: job.webhookId,
        institutionId: job.institutionId,
        url: job.url,
        secret: job.secret,
        event: job.event,
        payload: job.payload,
        attempt: job.attempt + 1,
      });
    } else if (!success) {
      this.log.warn(
        `Webhook ${job.webhookId} delivery ${job.deliveryId} failed after ${job.attempt} attempts: ${errorMessage}`,
      );
    }
  }
}
