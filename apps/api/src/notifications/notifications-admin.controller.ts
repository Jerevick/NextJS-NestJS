import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import type { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { SendBulkNotificationDto } from './dto/send-bulk-notification.dto';
import { NotificationBulkService } from './notification-bulk.service';
import { NotificationScheduleService } from './notification-schedule.service';
import { NotificationTemplateService } from './notification-template.service';
import { NotificationsService } from './notifications.service';
import type { SendNotificationInput } from './notification.types';

/** Phase 14 — template management and programmatic send. */
@Controller('notifications/admin')
@UseGuards(PermissionsGuard)
export class NotificationsAdminController {
  constructor(
    private readonly notifications: NotificationsService,
    private readonly templates: NotificationTemplateService,
    private readonly bulk: NotificationBulkService,
    private readonly schedule: NotificationScheduleService,
  ) {}

  @Get('templates')
  @RequirePermissions('institutions.write')
  listTemplates(@CurrentUser() user: AuthUser, @Query('entityId') entityId?: string) {
    return this.templates.listTemplates(user.institutionId, entityId);
  }

  @Post('templates')
  @RequirePermissions('institutions.write')
  upsertTemplate(
    @CurrentUser() user: AuthUser,
    @Body()
    body: {
      event: string;
      entityId?: string;
      channels?: Record<string, boolean>;
      subject?: string;
      htmlBody?: string;
      textBody?: string;
    },
  ) {
    return this.templates.upsertTemplate({
      institutionId: user.institutionId,
      entityId: body.entityId,
      event: body.event,
      channels: body.channels ?? { email: true, inApp: true },
      subject: body.subject,
      htmlBody: body.htmlBody,
      textBody: body.textBody,
    });
  }

  @Post('send')
  @RequirePermissions('institutions.write')
  send(@CurrentUser() user: AuthUser, @Body() body: Omit<SendNotificationInput, 'institutionId'>) {
    return this.notifications.send(user, {
      institutionId: user.institutionId,
      ...body,
    });
  }

  /**
   * Bulk broadcast — ALL_INSTITUTION | SPECIFIC_ENTITY | ALL_EXCEPT_ENTITY | BY_PROGRAMME.
   * Institution admins: all targets. Entity admins: own entity / programme only.
   */
  @Post('bulk')
  @RequirePermissions('notifications.broadcast')
  sendBulk(@CurrentUser() user: AuthUser, @Body() body: SendBulkNotificationDto) {
    if (body.scheduledAt) {
      return this.schedule.scheduleBulk(user, { ...body, scheduledAt: body.scheduledAt });
    }
    return this.bulk.send(user, body);
  }

  @Get('scheduled')
  @RequirePermissions('notifications.broadcast')
  listScheduled(@CurrentUser() user: AuthUser) {
    return this.schedule.listPending(user);
  }

  @Post('scheduled/:id/cancel')
  @RequirePermissions('notifications.broadcast')
  cancelScheduled(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.schedule.cancel(user, id);
  }
}
