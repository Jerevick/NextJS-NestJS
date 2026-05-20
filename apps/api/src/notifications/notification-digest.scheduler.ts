import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { NotificationDigestService } from './notification-digest.service';

@Injectable()
export class NotificationDigestScheduler {
  private readonly log = new Logger(NotificationDigestScheduler.name);

  constructor(private readonly digest: NotificationDigestService) {}

  @Cron(CronExpression.EVERY_HOUR)
  async flushDigests(): Promise<void> {
    try {
      const result = await this.digest.flushHourlyDigests();
      if (result.entries > 0) {
        this.log.log(`Hourly digest sent for ${result.users} user(s)`);
      }
    } catch (err) {
      this.log.error(`Digest flush failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
}
