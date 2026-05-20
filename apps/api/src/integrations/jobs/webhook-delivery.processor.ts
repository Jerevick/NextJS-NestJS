import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import { WEBHOOK_DELIVERY_QUEUE } from '../../queues/queue.constants';
import type { WebhookDispatchJob } from '../integration.types';
import { WebhookDeliveryService } from '../webhook-delivery.service';

@Processor(WEBHOOK_DELIVERY_QUEUE)
export class WebhookDeliveryProcessor extends WorkerHost {
  private readonly log = new Logger(WebhookDeliveryProcessor.name);

  constructor(private readonly delivery: WebhookDeliveryService) {
    super();
  }

  async process(job: Job<WebhookDispatchJob>): Promise<void> {
    await this.delivery.deliver(job.data);
    this.log.debug(`Webhook delivery ${job.data.deliveryId} processed`);
  }
}
