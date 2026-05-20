import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import { NOTIFICATION_DISPATCH_QUEUE } from '../../queues/queue.constants';
import { NotificationJobsService } from './notification-jobs.service';
import type { NotificationDispatchJob } from '../notification.types';

@Processor(NOTIFICATION_DISPATCH_QUEUE)
export class NotificationDispatchProcessor extends WorkerHost {
  private readonly log = new Logger(NotificationDispatchProcessor.name);

  constructor(private readonly jobs: NotificationJobsService) {
    super();
  }

  async process(job: Job<NotificationDispatchJob>): Promise<void> {
    await this.jobs.process(job.data);
    this.log.debug(
      `Dispatched ${job.data.channel} for ${job.data.event} → user ${job.data.recipientId}`,
    );
  }
}
