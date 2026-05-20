import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import { NOTIFICATION_BULK_QUEUE } from '../../queues/queue.constants';
import type { NotificationBulkJobData } from '../notification-bulk.types';
import { NotificationBulkService } from '../notification-bulk.service';

@Processor(NOTIFICATION_BULK_QUEUE)
export class NotificationBulkProcessor extends WorkerHost {
  private readonly log = new Logger(NotificationBulkProcessor.name);

  constructor(private readonly bulk: NotificationBulkService) {
    super();
  }

  async process(job: Job<NotificationBulkJobData>): Promise<void> {
    const result = await this.bulk.runJob(job.data);
    this.log.log(
      `Bulk job ${job.id}: ${result.sent} sent, ${result.failed} failed (${job.data.recipientIds.length} recipients)`,
    );
  }
}
