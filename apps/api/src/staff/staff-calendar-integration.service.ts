import { Injectable, Logger } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import { googleCalendarBlockUrl, outlookCalendarBlockUrl } from './staff-calendar.util';

type CalendarIntegrations = {
  google?: { refreshToken: string; calendarId?: string };
  microsoft?: { refreshToken: string; calendarId?: string };
};

@Injectable()
export class StaffCalendarIntegrationService {
  private readonly log = new Logger(StaffCalendarIntegrationService.name);

  private googleCreds() {
    const clientId =
      process.env.GOOGLE_CALENDAR_CLIENT_ID?.trim() ?? process.env.GOOGLE_CLIENT_ID?.trim();
    const clientSecret =
      process.env.GOOGLE_CALENDAR_CLIENT_SECRET?.trim() ?? process.env.GOOGLE_CLIENT_SECRET?.trim();
    if (!clientId || !clientSecret) return null;
    return { clientId, clientSecret };
  }

  private microsoftCreds() {
    const clientId = process.env.MICROSOFT_CALENDAR_CLIENT_ID?.trim();
    const clientSecret = process.env.MICROSOFT_CALENDAR_CLIENT_SECRET?.trim();
    const tenant = process.env.MICROSOFT_CALENDAR_TENANT?.trim() ?? 'common';
    if (!clientId || !clientSecret) return null;
    return { clientId, clientSecret, tenant };
  }

  isGoogleConfigured(): boolean {
    return this.googleCreds() !== null;
  }

  isMicrosoftConfigured(): boolean {
    return this.microsoftCreds() !== null;
  }

  googleConnectUrl(userId: string, institutionId: string): string {
    const creds = this.googleCreds();
    const secret = process.env.JWT_SECRET;
    if (!creds || !secret) {
      throw new Error('Google Calendar OAuth is not configured');
    }
    const apiBase =
      process.env.API_PUBLIC_URL?.trim() ?? `http://localhost:${process.env.PORT ?? '4000'}`;
    const redirectUri = `${apiBase.replace(/\/$/, '')}/staff/calendar-connect/google/callback`;
    const state = jwt.sign({ userId, institutionId, typ: 'staff_google_cal' }, secret, {
      expiresIn: '15m',
    });
    const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    url.searchParams.set('client_id', creds.clientId);
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', 'https://www.googleapis.com/auth/calendar.events openid email');
    url.searchParams.set('state', state);
    url.searchParams.set('access_type', 'offline');
    url.searchParams.set('prompt', 'consent');
    return url.toString();
  }

  microsoftConnectUrl(userId: string, institutionId: string): string {
    const creds = this.microsoftCreds();
    const secret = process.env.JWT_SECRET;
    if (!creds || !secret) {
      throw new Error('Microsoft Calendar OAuth is not configured');
    }
    const apiBase =
      process.env.API_PUBLIC_URL?.trim() ?? `http://localhost:${process.env.PORT ?? '4000'}`;
    const redirectUri = `${apiBase.replace(/\/$/, '')}/staff/calendar-connect/microsoft/callback`;
    const state = jwt.sign({ userId, institutionId, typ: 'staff_ms_cal' }, secret, {
      expiresIn: '15m',
    });
    const url = new URL(`https://login.microsoftonline.com/${creds.tenant}/oauth2/v2.0/authorize`);
    url.searchParams.set('client_id', creds.clientId);
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', 'offline_access Calendars.ReadWrite User.Read');
    url.searchParams.set('state', state);
    return url.toString();
  }

  async exchangeGoogleCode(
    code: string,
    state: string,
  ): Promise<{ userId: string; institutionId: string; refreshToken: string }> {
    const secret = process.env.JWT_SECRET;
    if (!secret) throw new Error('JWT_SECRET missing');
    const decoded = jwt.verify(state, secret) as {
      userId?: string;
      institutionId?: string;
      typ?: string;
    };
    if (decoded.typ !== 'staff_google_cal' || !decoded.userId || !decoded.institutionId) {
      throw new Error('Invalid OAuth state');
    }
    const creds = this.googleCreds();
    if (!creds) throw new Error('Google not configured');
    const apiBase =
      process.env.API_PUBLIC_URL?.trim() ?? `http://localhost:${process.env.PORT ?? '4000'}`;
    const redirectUri = `${apiBase.replace(/\/$/, '')}/staff/calendar-connect/google/callback`;
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: creds.clientId,
        client_secret: creds.clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });
    if (!tokenRes.ok) {
      throw new Error(`Google token exchange failed: ${await tokenRes.text()}`);
    }
    const tokens = (await tokenRes.json()) as { refresh_token?: string };
    if (!tokens.refresh_token) {
      throw new Error('Google did not return a refresh token');
    }
    return {
      userId: decoded.userId,
      institutionId: decoded.institutionId,
      refreshToken: tokens.refresh_token,
    };
  }

  async exchangeMicrosoftCode(
    code: string,
    state: string,
  ): Promise<{ userId: string; institutionId: string; refreshToken: string }> {
    const secret = process.env.JWT_SECRET;
    if (!secret) throw new Error('JWT_SECRET missing');
    const decoded = jwt.verify(state, secret) as {
      userId?: string;
      institutionId?: string;
      typ?: string;
    };
    if (decoded.typ !== 'staff_ms_cal' || !decoded.userId || !decoded.institutionId) {
      throw new Error('Invalid OAuth state');
    }
    const creds = this.microsoftCreds();
    if (!creds) throw new Error('Microsoft not configured');
    const apiBase =
      process.env.API_PUBLIC_URL?.trim() ?? `http://localhost:${process.env.PORT ?? '4000'}`;
    const redirectUri = `${apiBase.replace(/\/$/, '')}/staff/calendar-connect/microsoft/callback`;
    const tokenRes = await fetch(
      `https://login.microsoftonline.com/${creds.tenant}/oauth2/v2.0/token`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: creds.clientId,
          client_secret: creds.clientSecret,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code',
        }),
      },
    );
    if (!tokenRes.ok) {
      throw new Error(`Microsoft token exchange failed: ${await tokenRes.text()}`);
    }
    const tokens = (await tokenRes.json()) as { refresh_token?: string };
    if (!tokens.refresh_token) {
      throw new Error('Microsoft did not return a refresh token');
    }
    return {
      userId: decoded.userId,
      institutionId: decoded.institutionId,
      refreshToken: tokens.refresh_token,
    };
  }

  mergeCalendarIntegrations(
    profile: Record<string, unknown> | null,
    patch: Partial<CalendarIntegrations>,
  ): Record<string, unknown> {
    const base = profile && typeof profile === 'object' ? { ...profile } : {};
    const existing = (base.calendarIntegrations as CalendarIntegrations) ?? {};
    base.calendarIntegrations = { ...existing, ...patch };
    return base;
  }

  async pushLeaveToConnectedCalendars(input: {
    staffUserId: string;
    staffProfile: Record<string, unknown> | null;
    title: string;
    start: Date;
    end: Date;
    leaveRequestId: string;
  }): Promise<{
    googleEventId?: string;
    microsoftEventId?: string;
    deepLinks: { google: string; outlook: string };
  }> {
    const integrations = (input.staffProfile?.calendarIntegrations ?? {}) as CalendarIntegrations;
    const deepLinks = {
      google: googleCalendarBlockUrl(input.title, input.start, input.end),
      outlook: outlookCalendarBlockUrl(input.title, input.start, input.end),
    };
    const result: {
      googleEventId?: string;
      microsoftEventId?: string;
      deepLinks: { google: string; outlook: string };
    } = { deepLinks };

    if (integrations.google?.refreshToken) {
      try {
        result.googleEventId = await this.createGoogleEvent(
          integrations.google.refreshToken,
          integrations.google.calendarId ?? 'primary',
          input.title,
          input.start,
          input.end,
        );
      } catch (e) {
        this.log.warn(`Google calendar push failed for leave ${input.leaveRequestId}: ${e}`);
      }
    }

    if (integrations.microsoft?.refreshToken) {
      try {
        result.microsoftEventId = await this.createMicrosoftEvent(
          integrations.microsoft.refreshToken,
          input.title,
          input.start,
          input.end,
        );
      } catch (e) {
        this.log.warn(`Microsoft calendar push failed for leave ${input.leaveRequestId}: ${e}`);
      }
    }

    return result;
  }

  /**
   * Creates a timed calendar event with Google Meet join URL when OAuth is connected.
   */
  async createGoogleMeetEvent(
    refreshToken: string,
    calendarId: string,
    title: string,
    start: Date,
    end: Date,
  ): Promise<{ joinUrl: string; eventId: string } | null> {
    try {
      const access = await this.googleAccessToken(refreshToken);
      const requestId = `unicore-meet-${Date.now()}`;
      const res = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?conferenceDataVersion=1`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${access}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            summary: title,
            start: { dateTime: start.toISOString(), timeZone: 'UTC' },
            end: { dateTime: end.toISOString(), timeZone: 'UTC' },
            conferenceData: {
              createRequest: {
                requestId,
                conferenceSolutionKey: { type: 'hangoutsMeet' },
              },
            },
          }),
        },
      );
      if (!res.ok) throw new Error(await res.text());
      const event = (await res.json()) as {
        id?: string;
        hangoutLink?: string;
        conferenceData?: { entryPoints?: Array<{ uri?: string; entryPointType?: string }> };
      };
      const video = event.conferenceData?.entryPoints?.find((e) => e.entryPointType === 'video');
      const joinUrl = video?.uri ?? event.hangoutLink;
      if (!joinUrl || !event.id) return null;
      return { joinUrl, eventId: event.id };
    } catch (e) {
      this.log.warn(`Google Meet event failed: ${e}`);
      return null;
    }
  }

  async createGoogleMeetLink(
    refreshToken: string,
    calendarId: string,
    title: string,
    start: Date,
    end: Date,
  ): Promise<string | null> {
    const event = await this.createGoogleMeetEvent(refreshToken, calendarId, title, start, end);
    return event?.joinUrl ?? null;
  }

  async updateGoogleCalendarEvent(
    refreshToken: string,
    calendarId: string,
    eventId: string,
    title: string,
    start: Date,
    end: Date,
  ): Promise<void> {
    const access = await this.googleAccessToken(refreshToken);
    const res = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${access}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          summary: title,
          start: { dateTime: start.toISOString(), timeZone: 'UTC' },
          end: { dateTime: end.toISOString(), timeZone: 'UTC' },
        }),
      },
    );
    if (!res.ok) throw new Error(await res.text());
  }

  async deleteGoogleCalendarEvent(
    refreshToken: string,
    calendarId: string,
    eventId: string,
  ): Promise<void> {
    const access = await this.googleAccessToken(refreshToken);
    const res = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
      { method: 'DELETE', headers: { Authorization: `Bearer ${access}` } },
    );
    if (!res.ok && res.status !== 404) throw new Error(await res.text());
  }

  /**
   * Creates a timed calendar event with Microsoft Teams join URL when OAuth is connected.
   */
  async createTeamsMeetingEvent(
    refreshToken: string,
    title: string,
    start: Date,
    end: Date,
  ): Promise<{ joinUrl: string; eventId: string } | null> {
    try {
      const access = await this.microsoftAccessToken(refreshToken);
      const res = await fetch('https://graph.microsoft.com/v1.0/me/events', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${access}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          subject: title,
          start: { dateTime: start.toISOString(), timeZone: 'UTC' },
          end: { dateTime: end.toISOString(), timeZone: 'UTC' },
          isOnlineMeeting: true,
          onlineMeetingProvider: 'teamsForBusiness',
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const event = (await res.json()) as {
        id?: string;
        onlineMeeting?: { joinUrl?: string };
      };
      const joinUrl = event.onlineMeeting?.joinUrl;
      if (!joinUrl || !event.id) return null;
      return { joinUrl, eventId: event.id };
    } catch (e) {
      this.log.warn(`Teams meeting event failed: ${e}`);
      return null;
    }
  }

  async createTeamsMeetingLink(
    refreshToken: string,
    title: string,
    start: Date,
    end: Date,
  ): Promise<string | null> {
    const event = await this.createTeamsMeetingEvent(refreshToken, title, start, end);
    return event?.joinUrl ?? null;
  }

  async updateMicrosoftCalendarEvent(
    refreshToken: string,
    eventId: string,
    title: string,
    start: Date,
    end: Date,
  ): Promise<void> {
    const access = await this.microsoftAccessToken(refreshToken);
    const res = await fetch(
      `https://graph.microsoft.com/v1.0/me/events/${encodeURIComponent(eventId)}`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${access}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          subject: title,
          start: { dateTime: start.toISOString(), timeZone: 'UTC' },
          end: { dateTime: end.toISOString(), timeZone: 'UTC' },
        }),
      },
    );
    if (!res.ok) throw new Error(await res.text());
  }

  async deleteMicrosoftCalendarEvent(refreshToken: string, eventId: string): Promise<void> {
    const access = await this.microsoftAccessToken(refreshToken);
    const res = await fetch(
      `https://graph.microsoft.com/v1.0/me/events/${encodeURIComponent(eventId)}`,
      {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${access}` },
      },
    );
    if (!res.ok && res.status !== 404) throw new Error(await res.text());
  }

  async fetchGoogleCalendarEvent(
    refreshToken: string,
    calendarId: string,
    eventId: string,
  ): Promise<{ start?: string; summary?: string; status?: string; hangoutLink?: string } | null> {
    try {
      const access = await this.googleAccessToken(refreshToken);
      const res = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
        { headers: { Authorization: `Bearer ${access}` } },
      );
      if (!res.ok) return null;
      const event = (await res.json()) as {
        status?: string;
        summary?: string;
        start?: { dateTime?: string };
        hangoutLink?: string;
      };
      return {
        status: event.status,
        summary: event.summary,
        start: event.start?.dateTime,
        hangoutLink: event.hangoutLink,
      };
    } catch (e) {
      this.log.warn(`fetchGoogleCalendarEvent: ${e}`);
      return null;
    }
  }

  async fetchMicrosoftCalendarEvent(
    refreshToken: string,
    eventId: string,
  ): Promise<{ start?: string; subject?: string; isCancelled?: boolean; joinUrl?: string } | null> {
    try {
      const access = await this.microsoftAccessToken(refreshToken);
      const res = await fetch(
        `https://graph.microsoft.com/v1.0/me/events/${encodeURIComponent(eventId)}`,
        { headers: { Authorization: `Bearer ${access}` } },
      );
      if (!res.ok) return null;
      const event = (await res.json()) as {
        subject?: string;
        isCancelled?: boolean;
        start?: { dateTime?: string };
        onlineMeeting?: { joinUrl?: string };
      };
      return {
        subject: event.subject,
        isCancelled: event.isCancelled,
        start: event.start?.dateTime,
        joinUrl: event.onlineMeeting?.joinUrl,
      };
    } catch (e) {
      this.log.warn(`fetchMicrosoftCalendarEvent: ${e}`);
      return null;
    }
  }

  private async googleAccessToken(refreshToken: string): Promise<string> {
    const creds = this.googleCreds();
    if (!creds) throw new Error('Google not configured');
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        refresh_token: refreshToken,
        client_id: creds.clientId,
        client_secret: creds.clientSecret,
        grant_type: 'refresh_token',
      }),
    });
    if (!res.ok) throw new Error(await res.text());
    const json = (await res.json()) as { access_token?: string };
    if (!json.access_token) throw new Error('No access token');
    return json.access_token;
  }

  private async createGoogleEvent(
    refreshToken: string,
    calendarId: string,
    title: string,
    start: Date,
    end: Date,
  ): Promise<string> {
    const access = await this.googleAccessToken(refreshToken);
    const endExclusive = new Date(end);
    endExclusive.setUTCDate(endExclusive.getUTCDate() + 1);
    const res = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${access}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          summary: title,
          start: { date: start.toISOString().slice(0, 10) },
          end: { date: endExclusive.toISOString().slice(0, 10) },
          transparency: 'opaque',
        }),
      },
    );
    if (!res.ok) throw new Error(await res.text());
    const event = (await res.json()) as { id?: string };
    return event.id ?? 'created';
  }

  private async microsoftAccessToken(refreshToken: string): Promise<string> {
    const creds = this.microsoftCreds();
    if (!creds) throw new Error('Microsoft not configured');
    const res = await fetch(`https://login.microsoftonline.com/${creds.tenant}/oauth2/v2.0/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        refresh_token: refreshToken,
        client_id: creds.clientId,
        client_secret: creds.clientSecret,
        grant_type: 'refresh_token',
      }),
    });
    if (!res.ok) throw new Error(await res.text());
    const json = (await res.json()) as { access_token?: string };
    if (!json.access_token) throw new Error('No access token');
    return json.access_token;
  }

  private async createMicrosoftEvent(
    refreshToken: string,
    title: string,
    start: Date,
    end: Date,
  ): Promise<string> {
    const access = await this.microsoftAccessToken(refreshToken);
    const endExclusive = new Date(end);
    endExclusive.setUTCDate(endExclusive.getUTCDate() + 1);
    const res = await fetch('https://graph.microsoft.com/v1.0/me/events', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${access}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        subject: title,
        isAllDay: true,
        start: { dateTime: start.toISOString().slice(0, 10), timeZone: 'UTC' },
        end: { dateTime: endExclusive.toISOString().slice(0, 10), timeZone: 'UTC' },
        showAs: 'oof',
      }),
    });
    if (!res.ok) throw new Error(await res.text());
    const event = (await res.json()) as { id?: string };
    return event.id ?? 'created';
  }
}
