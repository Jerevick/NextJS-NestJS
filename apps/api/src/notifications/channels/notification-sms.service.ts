import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  readNotificationSettings,
  readUserPhone,
  type InstitutionSmsSettings,
} from '../notification-channel-settings.util';

@Injectable()
export class NotificationSmsService {
  private readonly log = new Logger(NotificationSmsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Twilio or Africa's Talking — institution `settings.notifications.sms`, else platform env. */
  async send(institutionId: string, userId: string, message: string): Promise<boolean> {
    const [inst, user] = await Promise.all([
      this.prisma.institution.findUnique({
        where: { id: institutionId },
        select: { settings: true },
      }),
      this.prisma.user.findFirst({
        where: { id: userId, institutionId, deletedAt: null },
        select: { profile: true },
      }),
    ]);

    const phone = readUserPhone(user?.profile);
    if (!phone) {
      this.log.warn(`No phone on user ${userId} — SMS skipped`);
      return false;
    }

    const channel = readNotificationSettings(inst?.settings);
    const sms = channel.sms ?? this.platformSms();
    if (!sms) {
      this.log.debug(`SMS not configured for institution ${institutionId}`);
      return false;
    }

    const body = message.slice(0, 1600);
    if (sms.provider === 'twilio') {
      await this.sendTwilio(sms, phone, body);
      return true;
    }
    await this.sendAfricasTalking(sms, phone, body);
    return true;
  }

  private platformSms(): InstitutionSmsSettings | null {
    const sid = process.env.TWILIO_ACCOUNT_SID?.trim();
    const token = process.env.TWILIO_AUTH_TOKEN?.trim();
    if (sid && token) {
      return {
        provider: 'twilio',
        accountSid: sid,
        authToken: token,
        from: process.env.TWILIO_FROM?.trim(),
      };
    }
    const apiKey = process.env.AFRICAS_TALKING_API_KEY?.trim();
    const username = process.env.AFRICAS_TALKING_USERNAME?.trim();
    if (apiKey && username) {
      return {
        provider: 'africas_talking',
        apiKey,
        username,
        from: process.env.AFRICAS_TALKING_FROM?.trim(),
      };
    }
    return null;
  }

  private async sendTwilio(cfg: InstitutionSmsSettings, to: string, body: string): Promise<void> {
    const accountSid = cfg.accountSid?.trim();
    const authToken = cfg.authToken?.trim();
    const from = cfg.from?.trim() ?? process.env.TWILIO_FROM?.trim();
    if (!accountSid || !authToken || !from) {
      throw new Error('Twilio requires accountSid, authToken, and from');
    }

    const params = new URLSearchParams({ To: to, From: from, Body: body });
    const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64');
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      },
    );
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Twilio ${res.status}: ${errText.slice(0, 200)}`);
    }
  }

  private async sendAfricasTalking(
    cfg: InstitutionSmsSettings,
    to: string,
    body: string,
  ): Promise<void> {
    const apiKey = cfg.apiKey?.trim();
    const username = cfg.username?.trim() ?? process.env.AFRICAS_TALKING_USERNAME?.trim();
    if (!apiKey || !username) {
      throw new Error("Africa's Talking requires apiKey and username");
    }

    const params = new URLSearchParams({
      username,
      to,
      message: body,
    });
    if (cfg.from?.trim()) {
      params.set('from', cfg.from.trim());
    }

    const res = await fetch('https://api.africastalking.com/version1/messaging', {
      method: 'POST',
      headers: {
        apiKey,
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Africa's Talking ${res.status}: ${errText.slice(0, 200)}`);
    }
  }
}
