import { Injectable, Logger } from '@nestjs/common';
import { MeetingStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StaffCalendarIntegrationService } from '../staff/staff-calendar-integration.service';

@Injectable()
export class CalendarWebhooksService {
  private readonly log = new Logger(CalendarWebhooksService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly calendar: StaffCalendarIntegrationService,
  ) {}

  async handleGooglePush(
    headers: Record<string, string | undefined>,
    meetingId?: string,
  ): Promise<void> {
    const resourceState = headers['x-goog-resource-state'];
    if (resourceState === 'sync') return;

    if (meetingId) {
      const meeting = await this.prisma.meeting.findUnique({ where: { id: meetingId } });
      if (meeting?.googleCalendarEventId) {
        await this.reconcileGoogleMeeting(meeting);
      }
      return;
    }

    const meetings = await this.prisma.meeting.findMany({
      where: { googleCalendarEventId: { not: null }, deletedAt: null },
      take: 15,
      orderBy: { updatedAt: 'desc' },
    });
    for (const meeting of meetings) {
      await this.reconcileGoogleMeeting(meeting);
    }
  }

  async handleMicrosoftNotification(body: {
    value?: Array<{ resource?: string; changeType?: string; clientState?: string }>;
  }): Promise<void> {
    for (const item of body.value ?? []) {
      const meetingId = item.clientState;
      if (meetingId) {
        const meeting = await this.prisma.meeting.findUnique({ where: { id: meetingId } });
        if (meeting) {
          if (meeting.microsoftCalendarEventId) {
            await this.reconcileMicrosoftMeeting(meeting);
          }
          continue;
        }
      }
      if (!item.resource?.includes('/events/')) continue;
      const eventId = item.resource.split('/events/')[1]?.split('?')[0];
      if (!eventId) continue;
      const meeting = await this.prisma.meeting.findFirst({
        where: { microsoftCalendarEventId: eventId },
      });
      if (meeting) await this.reconcileMicrosoftMeeting(meeting);
    }
  }

  private async convenerGoogleRefresh(meeting: {
    institutionId: string;
    entityId: string;
    convenerPositionId: string;
  }): Promise<{ refreshToken: string; calendarId: string } | null> {
    const holder = await this.prisma.positionHolder.findFirst({
      where: {
        institutionId: meeting.institutionId,
        entityId: meeting.entityId,
        positionId: meeting.convenerPositionId,
        endDate: null,
      },
      orderBy: { startDate: 'desc' },
      select: { user: { select: { profile: true } } },
    });
    const profile = (holder?.user?.profile ?? {}) as Record<string, unknown>;
    const integrations = (profile.calendarIntegrations ?? {}) as {
      google?: { refreshToken: string; calendarId?: string };
    };
    if (!integrations.google?.refreshToken) return null;
    return {
      refreshToken: integrations.google.refreshToken,
      calendarId: integrations.google.calendarId ?? 'primary',
    };
  }

  private async convenerMicrosoftRefresh(meeting: {
    institutionId: string;
    entityId: string;
    convenerPositionId: string;
  }): Promise<string | null> {
    const holder = await this.prisma.positionHolder.findFirst({
      where: {
        institutionId: meeting.institutionId,
        entityId: meeting.entityId,
        positionId: meeting.convenerPositionId,
        endDate: null,
      },
      orderBy: { startDate: 'desc' },
      select: { user: { select: { profile: true } } },
    });
    const profile = (holder?.user?.profile ?? {}) as Record<string, unknown>;
    const integrations = (profile.calendarIntegrations ?? {}) as {
      microsoft?: { refreshToken: string };
    };
    return integrations.microsoft?.refreshToken ?? null;
  }

  private async reconcileGoogleMeeting(meeting: {
    id: string;
    institutionId: string;
    entityId: string;
    convenerPositionId: string;
    googleCalendarEventId: string | null;
  }): Promise<void> {
    if (!meeting.googleCalendarEventId) return;
    const creds = await this.convenerGoogleRefresh(meeting);
    if (!creds) return;
    const event = await this.calendar.fetchGoogleCalendarEvent(
      creds.refreshToken,
      creds.calendarId,
      meeting.googleCalendarEventId,
    );
    if (!event) return;
    if (event.status === 'cancelled') {
      await this.prisma.meeting.update({
        where: { id: meeting.id },
        data: { status: MeetingStatus.CANCELLED },
      });
      return;
    }
    await this.prisma.meeting.update({
      where: { id: meeting.id },
      data: {
        ...(event.start ? { scheduledAt: new Date(event.start) } : {}),
        ...(event.summary ? { title: event.summary } : {}),
        ...(event.hangoutLink ? { meetingLink: event.hangoutLink } : {}),
      },
    });
    this.log.log(`Google webhook reconciled meeting ${meeting.id}`);
  }

  private async reconcileMicrosoftMeeting(meeting: {
    id: string;
    institutionId: string;
    entityId: string;
    convenerPositionId: string;
    microsoftCalendarEventId: string | null;
  }): Promise<void> {
    if (!meeting.microsoftCalendarEventId) return;
    const refresh = await this.convenerMicrosoftRefresh(meeting);
    if (!refresh) return;
    const event = await this.calendar.fetchMicrosoftCalendarEvent(
      refresh,
      meeting.microsoftCalendarEventId,
    );
    if (!event) return;
    if (event.isCancelled) {
      await this.prisma.meeting.update({
        where: { id: meeting.id },
        data: { status: MeetingStatus.CANCELLED },
      });
      return;
    }
    await this.prisma.meeting.update({
      where: { id: meeting.id },
      data: {
        ...(event.start ? { scheduledAt: new Date(event.start) } : {}),
        ...(event.subject ? { title: event.subject } : {}),
        ...(event.joinUrl ? { meetingLink: event.joinUrl } : {}),
      },
    });
    this.log.log(`Microsoft webhook reconciled meeting ${meeting.id}`);
  }
}
