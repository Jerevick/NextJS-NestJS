import { DynamicModule, Logger, Module } from '@nestjs/common';
import { BullModule, getQueueToken } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { MailService } from '../mail/mail.service';
import {
  NOTIFICATION_BULK_QUEUE,
  NOTIFICATION_DISPATCH_QUEUE,
  NOTIFICATION_SCHEDULED_QUEUE,
} from '../queues/queue.constants';
import { StorageModule } from '../storage/storage.module';
import { NotificationEmailService } from './channels/notification-email.service';
import { NotificationPushService } from './channels/notification-push.service';
import { NotificationSmsService } from './channels/notification-sms.service';
import { NotificationChannelService } from './notification-channel.service';
import { NotificationEngineService } from './notification-engine.service';
import { NotificationEventsService } from './notification-events.service';
import { NotificationTemplateService } from './notification-template.service';
import { NotificationBulkService } from './notification-bulk.service';
import { NotificationScheduleService } from './notification-schedule.service';
import { NotificationBulkProcessor } from './jobs/notification-bulk.processor';
import { NotificationScheduledProcessor } from './jobs/notification-scheduled.processor';
import { NotificationDigestScheduler } from './notification-digest.scheduler';
import { NotificationDigestService } from './notification-digest.service';
import { NotificationDispatchProcessor } from './jobs/notification-dispatch.processor';
import { NotificationJobsService } from './jobs/notification-jobs.service';
import { NotificationsAdminController } from './notifications-admin.controller';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';

const log = new Logger('NotificationsModule');

@Module({})
export class NotificationsModule {
  static register(): DynamicModule {
    const useBull = Boolean(process.env.REDIS_URL?.trim());
    if (!useBull) {
      log.warn('REDIS_URL is not set — notification dispatch runs synchronously in-process.');
    }
    return {
      module: NotificationsModule,
      imports: [
        StorageModule,
        ...(useBull
          ? [
              BullModule.registerQueue({ name: NOTIFICATION_DISPATCH_QUEUE }),
              BullModule.registerQueue({ name: NOTIFICATION_BULK_QUEUE }),
              BullModule.registerQueue({ name: NOTIFICATION_SCHEDULED_QUEUE }),
            ]
          : []),
      ],
      controllers: [NotificationsController, NotificationsAdminController],
      providers: [
        NotificationsService,
        NotificationEngineService,
        NotificationEventsService,
        NotificationBulkService,
        NotificationScheduleService,
        NotificationDigestService,
        NotificationDigestScheduler,
        NotificationTemplateService,
        NotificationChannelService,
        NotificationEmailService,
        NotificationSmsService,
        NotificationPushService,
        MailService,
        {
          provide: NotificationJobsService,
          useFactory: (channels: NotificationChannelService, queue?: Queue) =>
            new NotificationJobsService(channels, queue ?? null),
          inject: [
            NotificationChannelService,
            ...(useBull ? [getQueueToken(NOTIFICATION_DISPATCH_QUEUE)] : []),
          ],
        },
        PermissionsGuard,
        ...(useBull
          ? [
              NotificationDispatchProcessor,
              NotificationBulkProcessor,
              NotificationScheduledProcessor,
            ]
          : []),
      ],
      exports: [NotificationsService, NotificationEngineService, NotificationEventsService],
    };
  }
}
