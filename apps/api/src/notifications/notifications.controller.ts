import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { ListNotificationsQueryDto } from './dto/list-notifications-query.dto';
import { NotificationsService } from './notifications.service';
import type { SendNotificationInput } from './notification.types';

@Throttle({ default: { limit: 120, ttl: 60_000 } })
@Controller('notifications')
@UseGuards(PermissionsGuard)
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query() query: ListNotificationsQueryDto) {
    return this.notifications.listForUser(user, query);
  }

  @Get(':id')
  getOne(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Query('markRead') markRead?: string,
  ) {
    const shouldMark = markRead === undefined || markRead === '1' || markRead === 'true';
    return this.notifications.getById(user, id, shouldMark);
  }

  @Patch(':id/read')
  markRead(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.notifications.markRead(user, id);
  }

  @Post('read-all')
  markAllRead(@CurrentUser() user: AuthUser) {
    return this.notifications.markAllRead(user);
  }

  /** Programmatic send — matches master prompt `NotificationService.send`. */
  @Post('send')
  @RequirePermissions('institutions.write')
  send(@CurrentUser() user: AuthUser, @Body() body: Omit<SendNotificationInput, 'institutionId'>) {
    return this.notifications.send(user, {
      institutionId: user.institutionId,
      ...body,
    });
  }
}
