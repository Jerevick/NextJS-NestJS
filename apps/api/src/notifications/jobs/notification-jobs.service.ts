import { Injectable, Logger } from '@nestjs/common';
import type { Queue } from 'bullmq';
import { NotificationChannelService } from '../notification-channel.service';
import type { NotificationChannel, NotificationDispatchJob } from '../notification.types';

@Injectable()
export class NotificationJobsService {
  private readonly log = new Logger(NotificationJobsService.name);

  constructor(
    private readonly channels: NotificationChannelService,
    private readonly queue: Queue<NotificationDispatchJob> | null,
  ) {}

  /**
   * Enqueues one BullMQ job per channel; falls back to synchronous dispatch without Redis.
   */
  async enqueueAll(
    base: Omit<NotificationDispatchJob, 'channel'>,
    channelList: NotificationChannel[],
  ): Promise<{ notificationId?: string }> {
    let notificationId: string | undefined;

    for (const channel of channelList) {
      const job: NotificationDispatchJob = { ...base, channel };
      if (this.queue) {
        await this.queue.add(`dispatch:${channel}`, job, {
          removeOnComplete: 200,
          priority: base.priority === 'HIGH' ? 1 : base.priority === 'LOW' ? 10 : 5,
        });
      } else {
        const id = await this.process(job);
        if (channel === 'inApp' && id) notificationId = id;
      }
    }

    return { notificationId };
  }

  async process(job: NotificationDispatchJob): Promise<string | undefined> {
    try {
      return await this.channels.dispatch(job);
    } catch (err) {
      this.log.warn(
        `Channel ${job.channel} failed for ${job.event}: ${err instanceof Error ? err.message : String(err)}`,
      );
      if (job.channel === 'push') {
        this.log.debug(`Push failed — falling back to email for ${job.event}`);
        try {
          return await this.channels.dispatch({
            ...job,
            channel: 'email',
            metadata: { ...job.metadata, channelFallback: 'push→email' },
          });
        } catch (emailErr) {
          this.log.warn(
            `Email fallback failed: ${emailErr instanceof Error ? emailErr.message : String(emailErr)}`,
          );
        }
      }
      return undefined;
    }
  }
}
