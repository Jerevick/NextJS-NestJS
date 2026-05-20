import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import { NOTIFICATION_SCHEDULED_QUEUE } from '../../queues/queue.constants';
import type { ScheduledNotificationJobData } from '../notification-schedule.types';
import { NotificationScheduleService } from '../notification-schedule.service';

@Processor(NOTIFICATION_SCHEDULED_QUEUE)
export class NotificationScheduledProcessor extends WorkerHost {
  private readonly log = new Logger(NotificationScheduledProcessor.name);

  constructor(private readonly schedule: NotificationScheduleService) {
    super();
  }

  async process(job: Job<ScheduledNotificationJobData>): Promise<void> {
    this.log.debug(`Delivering scheduled notification ${job.data.scheduledNotificationId}`);
    await this.schedule.deliver(job.data.scheduledNotificationId);
  }
}
