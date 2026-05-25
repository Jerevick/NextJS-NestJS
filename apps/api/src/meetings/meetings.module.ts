import { forwardRef, Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { NotificationsModule } from '../modules/notifications';
import { StorageModule } from '../storage/storage.module';
import { StaffCoreModule } from '../staff/staff-core.module';
import { WorkflowEngineModule } from '../workflow-engine/workflow-engine.module';
import { MailService } from '../mail/mail.service';
import { MeetingConferenceService } from './meeting-conference.service';
import { MeetingZoomService } from './meeting-zoom.service';
import { MeetingsCalendarSyncService } from './meetings-calendar-sync.service';
import { MeetingMinutesFileService } from './meeting-minutes-file.service';
import { CalendarWebhooksController } from './calendar-webhooks.controller';
import { CalendarWebhooksService } from './calendar-webhooks.service';
import { MeetingsController } from './meetings.controller';
import { MeetingsNotificationsService } from './meetings-notifications.service';
import { MeetingsRepository } from './meetings.repository';
import { MeetingsSchedulerService } from './meetings-scheduler.service';
import { MeetingsService } from './meetings.service';

/** Phase 11 meetings: governance, resolutions, AI minutes, registrar filing. */
@Module({
  imports: [
    AuditModule,
    NotificationsModule.register(),
    StorageModule,
    forwardRef(() => StaffCoreModule),
    forwardRef(() => WorkflowEngineModule),
  ],
  controllers: [MeetingsController, CalendarWebhooksController],
  providers: [
    CalendarWebhooksService,
    MeetingsService,
    MeetingsRepository,
    MeetingsNotificationsService,
    MeetingsSchedulerService,
    MeetingMinutesFileService,
    MeetingConferenceService,
    MeetingZoomService,
    MeetingsCalendarSyncService,
    MailService,
    PermissionsGuard,
  ],
  exports: [MeetingsService, MeetingsRepository],
})
export class MeetingsModule {}
