import { Injectable, Logger } from '@nestjs/common';
import { MeetingStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StaffCalendarIntegrationService } from '../staff/staff-calendar-integration.service';
import { MeetingZoomService } from './meeting-zoom.service';

type CalendarIntegrations = {
  google?: { refreshToken: string; calendarId?: string };
  microsoft?: { refreshToken: string; calendarId?: string };
};

export type ConferenceProvisionResult = {
  meetingLink?: string;
  zoomMeetingId?: string;
  googleCalendarEventId?: string;
  microsoftCalendarEventId?: string;
};

@Injectable()
export class MeetingsCalendarSyncService {
  private readonly log = new Logger(MeetingsCalendarSyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly calendar: StaffCalendarIntegrationService,
    private readonly zoom: MeetingZoomService,
  ) {}

  private async convenerIntegrations(
    institutionId: string,
    entityId: string,
    convenerPositionId: string,
  ): Promise<CalendarIntegrations> {
    const holder = await this.prisma.positionHolder.findFirst({
      where: { institutionId, entityId, positionId: convenerPositionId, endDate: null },
      orderBy: { startDate: 'desc' },
      select: { user: { select: { profile: true } } },
    });
    const profile = (holder?.user?.profile ?? {}) as Record<string, unknown>;
    return (profile.calendarIntegrations ?? {}) as CalendarIntegrations;
  }

  async provisionConference(args: {
    institutionId: string;
    entityId: string;
    convenerPositionId: string;
    title: string;
    scheduledAt: Date;
    durationMinutes: number;
  }): Promise<ConferenceProvisionResult> {
    const end = new Date(args.scheduledAt.getTime() + args.durationMinutes * 60_000);
    const integrations = await this.convenerIntegrations(
      args.institutionId,
      args.entityId,
      args.convenerPositionId,
    );

    if (this.zoom.isConfigured()) {
      const zm = await this.zoom.createMeeting({
        title: args.title,
        scheduledAt: args.scheduledAt,
        durationMinutes: args.durationMinutes,
      });
      if (zm) {
        return { meetingLink: zm.joinUrl, zoomMeetingId: zm.meetingId };
      }
    }

    if (integrations.google?.refreshToken) {
      const g = await this.calendar.createGoogleMeetEvent(
        integrations.google.refreshToken,
        integrations.google.calendarId ?? 'primary',
        args.title,
        args.scheduledAt,
        end,
      );
      if (g) {
        return {
          meetingLink: g.joinUrl,
          googleCalendarEventId: g.eventId,
        };
      }
    }

    if (integrations.microsoft?.refreshToken) {
      const t = await this.calendar.createTeamsMeetingEvent(
        integrations.microsoft.refreshToken,
        args.title,
        args.scheduledAt,
        end,
      );
      if (t) {
        return {
          meetingLink: t.joinUrl,
          microsoftCalendarEventId: t.eventId,
        };
      }
    }

    if (process.env.MEETINGS_DEFAULT_LINK?.trim()) {
      return { meetingLink: `${process.env.MEETINGS_DEFAULT_LINK.trim()}?m=${Date.now()}` };
    }
    return {};
  }

  async syncMeetingUpdate(meeting: {
    id: string;
    institutionId: string;
    entityId: string;
    convenerPositionId: string;
    title: string;
    scheduledAt: Date;
    durationMinutes: number;
    status: MeetingStatus;
    zoomMeetingId: string | null;
    googleCalendarEventId: string | null;
    microsoftCalendarEventId: string | null;
  }): Promise<void> {
    if (meeting.status === MeetingStatus.CANCELLED) {
      await this.syncMeetingDelete(meeting);
      return;
    }
    const end = new Date(meeting.scheduledAt.getTime() + meeting.durationMinutes * 60_000);
    const integrations = await this.convenerIntegrations(
      meeting.institutionId,
      meeting.entityId,
      meeting.convenerPositionId,
    );
    try {
      if (meeting.zoomMeetingId) {
        await this.zoom.updateMeeting(meeting.zoomMeetingId, {
          title: meeting.title,
          scheduledAt: meeting.scheduledAt,
          durationMinutes: meeting.durationMinutes,
        });
      }
      if (meeting.googleCalendarEventId && integrations.google?.refreshToken) {
        await this.calendar.updateGoogleCalendarEvent(
          integrations.google.refreshToken,
          integrations.google.calendarId ?? 'primary',
          meeting.googleCalendarEventId,
          meeting.title,
          meeting.scheduledAt,
          end,
        );
      }
      if (meeting.microsoftCalendarEventId && integrations.microsoft?.refreshToken) {
        await this.calendar.updateMicrosoftCalendarEvent(
          integrations.microsoft.refreshToken,
          meeting.microsoftCalendarEventId,
          meeting.title,
          meeting.scheduledAt,
          end,
        );
      }
    } catch (e) {
      this.log.warn(`Calendar update failed for meeting ${meeting.id}: ${e}`);
    }
  }

  async syncMeetingDelete(meeting: {
    zoomMeetingId: string | null;
    googleCalendarEventId: string | null;
    microsoftCalendarEventId: string | null;
    institutionId: string;
    entityId: string;
    convenerPositionId: string;
  }): Promise<void> {
    const integrations = await this.convenerIntegrations(
      meeting.institutionId,
      meeting.entityId,
      meeting.convenerPositionId,
    );
    if (meeting.zoomMeetingId) {
      await this.zoom.deleteMeeting(meeting.zoomMeetingId);
    }
    try {
      if (meeting.googleCalendarEventId && integrations.google?.refreshToken) {
        await this.calendar.deleteGoogleCalendarEvent(
          integrations.google.refreshToken,
          integrations.google.calendarId ?? 'primary',
          meeting.googleCalendarEventId,
        );
      }
      if (meeting.microsoftCalendarEventId && integrations.microsoft?.refreshToken) {
        await this.calendar.deleteMicrosoftCalendarEvent(
          integrations.microsoft.refreshToken,
          meeting.microsoftCalendarEventId,
        );
      }
    } catch (e) {
      this.log.warn(`Calendar delete failed: ${e}`);
    }
  }
}
