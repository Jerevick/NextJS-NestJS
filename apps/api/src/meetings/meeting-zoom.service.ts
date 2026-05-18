import { createHmac } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';

type ZoomMeetingResponse = {
  id?: number;
  join_url?: string;
  start_url?: string;
};

@Injectable()
export class MeetingZoomService {
  private readonly log = new Logger(MeetingZoomService.name);
  private tokenCache: { accessToken: string; expiresAt: number } | null = null;

  isConfigured(): boolean {
    return Boolean(
      process.env.ZOOM_ACCOUNT_ID?.trim() &&
      process.env.ZOOM_CLIENT_ID?.trim() &&
      process.env.ZOOM_CLIENT_SECRET?.trim(),
    );
  }

  async createMeeting(args: {
    title: string;
    scheduledAt: Date;
    durationMinutes: number;
  }): Promise<{ meetingId: string; joinUrl: string } | null> {
    if (!this.isConfigured()) return null;
    try {
      const token = await this.accessToken();
      const res = await fetch('https://api.zoom.us/v2/users/me/meetings', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          topic: args.title,
          type: 2,
          start_time: args.scheduledAt.toISOString(),
          duration: args.durationMinutes,
          timezone: 'UTC',
          settings: {
            join_before_host: true,
            waiting_room: true,
          },
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const body = (await res.json()) as ZoomMeetingResponse;
      if (!body.id || !body.join_url) return null;
      return { meetingId: String(body.id), joinUrl: body.join_url };
    } catch (e) {
      this.log.warn(`Zoom meeting create failed: ${e}`);
      return null;
    }
  }

  async updateMeeting(
    zoomMeetingId: string,
    args: { title: string; scheduledAt: Date; durationMinutes: number },
  ): Promise<void> {
    if (!this.isConfigured() || !zoomMeetingId) return;
    try {
      const token = await this.accessToken();
      const res = await fetch(
        `https://api.zoom.us/v2/meetings/${encodeURIComponent(zoomMeetingId)}`,
        {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            topic: args.title,
            start_time: args.scheduledAt.toISOString(),
            duration: args.durationMinutes,
            timezone: 'UTC',
          }),
        },
      );
      if (!res.ok) throw new Error(await res.text());
    } catch (e) {
      this.log.warn(`Zoom meeting update failed: ${e}`);
    }
  }

  /** Meeting SDK signature (browser join). */
  generateSdkSignature(meetingNumber: string, role = 0): string | null {
    const sdkKey = process.env.ZOOM_SDK_KEY?.trim() ?? process.env.ZOOM_CLIENT_ID?.trim();
    const sdkSecret = process.env.ZOOM_SDK_SECRET?.trim() ?? process.env.ZOOM_CLIENT_SECRET?.trim();
    if (!sdkKey || !sdkSecret) return null;
    const iat = Math.floor(Date.now() / 1000) - 30;
    const exp = iat + 60 * 60 * 2;
    const tokenPayload = {
      sdkKey,
      mn: meetingNumber.replace(/\D/g, ''),
      role,
      iat,
      exp,
      tokenExp: exp,
    };
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(JSON.stringify(tokenPayload)).toString('base64url');
    const sig = createHmac('sha256', sdkSecret).update(`${header}.${payload}`).digest('base64url');
    return `${header}.${payload}.${sig}`;
  }

  extractMeetingNumber(joinUrl: string): string | null {
    const m = joinUrl.match(/\/j\/(\d+)/) ?? joinUrl.match(/[?&]mn=(\d+)/);
    return m?.[1] ?? null;
  }

  async deleteMeeting(zoomMeetingId: string): Promise<void> {
    if (!this.isConfigured() || !zoomMeetingId) return;
    try {
      const token = await this.accessToken();
      await fetch(`https://api.zoom.us/v2/meetings/${encodeURIComponent(zoomMeetingId)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch (e) {
      this.log.warn(`Zoom meeting delete failed: ${e}`);
    }
  }

  private async accessToken(): Promise<string> {
    if (this.tokenCache && this.tokenCache.expiresAt > Date.now() + 60_000) {
      return this.tokenCache.accessToken;
    }
    const accountId = process.env.ZOOM_ACCOUNT_ID!.trim();
    const clientId = process.env.ZOOM_CLIENT_ID!.trim();
    const clientSecret = process.env.ZOOM_CLIENT_SECRET!.trim();
    const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    const res = await fetch(
      `https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${encodeURIComponent(accountId)}`,
      {
        method: 'POST',
        headers: { Authorization: `Basic ${basic}` },
      },
    );
    if (!res.ok) throw new Error(await res.text());
    const json = (await res.json()) as { access_token?: string; expires_in?: number };
    if (!json.access_token) throw new Error('Zoom token missing');
    this.tokenCache = {
      accessToken: json.access_token,
      expiresAt: Date.now() + (json.expires_in ?? 3600) * 1000,
    };
    return json.access_token;
  }
}
