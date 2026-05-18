import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { MeetingsNotificationsService } from './meetings-notifications.service';

@Injectable()
export class MeetingsSchedulerService {
  private readonly log = new Logger(MeetingsSchedulerService.name);

  constructor(private readonly notify: MeetingsNotificationsService) {}

  @Cron('0 8 * * *')
  async remindActionItems() {
    const count = await this.notify.remindDueActionItems();
    if (count > 0) {
      this.log.log(`Sent ${count} meeting action item reminders`);
    }
  }
}
