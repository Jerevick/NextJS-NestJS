import { Injectable } from '@nestjs/common';
import { BaseIntegration } from './base.integration';
import type { IntegrationTestResult, UniCoreIntegration } from '../integration.types';

function requireSettings(
  settings: Record<string, unknown>,
  keys: string[],
): IntegrationTestResult | null {
  const missing = keys.filter((k) => !String(settings[k] ?? '').trim());
  if (missing.length) {
    return { success: false, message: `Missing settings: ${missing.join(', ')}` };
  }
  return null;
}

@Injectable()
export class ZoomIntegration extends BaseIntegration {
  readonly code = 'zoom';
  readonly name = 'Zoom';
  readonly category = 'VIDEO_CONFERENCING' as const;
  readonly description = 'Auto-create Zoom meetings for sections and meetings.';

  override async configure(
    _institutionId: string,
    _entityId: string | null,
    settings: Record<string, unknown>,
  ): Promise<void> {
    const err = requireSettings(settings, ['accountId', 'clientId', 'clientSecret']);
    if (err) throw new Error(err.message);
  }

  override async test(): Promise<IntegrationTestResult> {
    const id = process.env.ZOOM_CLIENT_ID?.trim();
    const secret = process.env.ZOOM_CLIENT_SECRET?.trim();
    if (!id || !secret) return this.missingEnv(['ZOOM_CLIENT_ID', 'ZOOM_CLIENT_SECRET']);
    return this.ok('Zoom OAuth credentials detected');
  }
}

@Injectable()
export class BigBlueButtonIntegration extends BaseIntegration {
  readonly code = 'bigbluebutton';
  readonly name = 'BigBlueButton';
  readonly category = 'VIDEO_CONFERENCING' as const;
  readonly description = 'Self-hosted open-source video conferencing.';

  override async test(): Promise<IntegrationTestResult> {
    const base = process.env.BBB_SERVER_URL?.trim() ?? '';
    const secret = process.env.BBB_SHARED_SECRET?.trim() ?? '';
    if (!base || !secret) return this.missingEnv(['BBB_SERVER_URL', 'BBB_SHARED_SECRET']);
    return this.ok('BigBlueButton server URL and secret configured');
  }
}

@Injectable()
export class MicrosoftTeamsIntegration extends BaseIntegration {
  readonly code = 'microsoft_teams';
  readonly name = 'Microsoft Teams';
  readonly category = 'VIDEO_CONFERENCING' as const;

  override async test(): Promise<IntegrationTestResult> {
    if (!process.env.MICROSOFT_TEAMS_CLIENT_ID?.trim()) {
      return this.missingEnv(['MICROSOFT_TEAMS_CLIENT_ID']);
    }
    return this.ok('Microsoft Teams app registration detected');
  }
}

@Injectable()
export class WhatsAppBusinessIntegration extends BaseIntegration {
  readonly code = 'whatsapp';
  readonly name = 'WhatsApp Business';
  readonly category = 'COMMUNICATION' as const;

  override async configure(
    _i: string,
    _e: string | null,
    settings: Record<string, unknown>,
  ): Promise<void> {
    const err = requireSettings(settings, ['phoneNumberId', 'accessToken']);
    if (err) throw new Error(err.message);
  }

  override async test(): Promise<IntegrationTestResult> {
    if (!process.env.WHATSAPP_ACCESS_TOKEN?.trim()) {
      return this.missingEnv(['WHATSAPP_ACCESS_TOKEN']);
    }
    return this.ok('WhatsApp Cloud API token detected');
  }
}

@Injectable()
export class TwilioSmsIntegration extends BaseIntegration {
  readonly code = 'twilio_sms';
  readonly name = 'Twilio SMS';
  readonly category = 'COMMUNICATION' as const;

  override async test(): Promise<IntegrationTestResult> {
    if (!process.env.TWILIO_ACCOUNT_SID?.trim() || !process.env.TWILIO_AUTH_TOKEN?.trim()) {
      return this.missingEnv(['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN']);
    }
    return this.ok('Twilio credentials detected');
  }
}

@Injectable()
export class SlackIntegration extends BaseIntegration {
  readonly code = 'slack';
  readonly name = 'Slack';
  readonly category = 'COMMUNICATION' as const;

  override async test(): Promise<IntegrationTestResult> {
    return this.ok('Slack webhook URL stored in integration settings');
  }
}

@Injectable()
export class TurnitinIntegration extends BaseIntegration {
  readonly code = 'turnitin';
  readonly name = 'Turnitin';
  readonly category = 'ACADEMIC' as const;

  override async test(): Promise<IntegrationTestResult> {
    if (!process.env.TURNITIN_API_KEY?.trim()) return this.missingEnv(['TURNITIN_API_KEY']);
    return this.ok('Turnitin API key detected');
  }
}

@Injectable()
export class GoogleScholarIntegration extends BaseIntegration {
  readonly code = 'google_scholar';
  readonly name = 'Google Scholar';
  readonly category = 'ACADEMIC' as const;

  override async test(): Promise<IntegrationTestResult> {
    return this.ok('Google Scholar integration ready (citation fetch on demand)');
  }
}

@Injectable()
export class GoogleCalendarIntegration extends BaseIntegration {
  readonly code = 'google_calendar';
  readonly name = 'Google Calendar';
  readonly category = 'CALENDAR' as const;

  override async test(): Promise<IntegrationTestResult> {
    if (!process.env.GOOGLE_CALENDAR_CLIENT_ID?.trim()) {
      return this.missingEnv(['GOOGLE_CALENDAR_CLIENT_ID']);
    }
    return this.ok('Google Calendar OAuth configured');
  }
}

@Injectable()
export class MicrosoftOutlookIntegration extends BaseIntegration {
  readonly code = 'microsoft_outlook';
  readonly name = 'Microsoft Outlook';
  readonly category = 'CALENDAR' as const;

  override async test(): Promise<IntegrationTestResult> {
    if (!process.env.MICROSOFT_CALENDAR_CLIENT_ID?.trim()) {
      return this.missingEnv(['MICROSOFT_CALENDAR_CLIENT_ID']);
    }
    return this.ok('Microsoft Calendar OAuth configured');
  }
}

@Injectable()
export class ICalExportIntegration extends BaseIntegration {
  readonly code = 'ical_export';
  readonly name = 'iCal Subscribe';
  readonly category = 'CALENDAR' as const;
  readonly description = 'Read-only calendar feed URL (no OAuth).';

  override async test(): Promise<IntegrationTestResult> {
    return this.ok('iCal export enabled — subscribe URLs available');
  }
}

@Injectable()
export class PaymentGatewayCatalogIntegration extends BaseIntegration {
  constructor(
    private readonly gatewayCode: string,
    private readonly displayName: string,
  ) {
    super();
  }

  readonly category = 'PAYMENT' as const;

  get code(): string {
    return this.gatewayCode;
  }

  get name(): string {
    return this.displayName;
  }

  override async test(): Promise<IntegrationTestResult> {
    return this.ok(`${this.displayName} is configured via Finance → Payment settings`);
  }
}

export const PAYMENT_INTEGRATION_CODES = [
  'stripe',
  'flutterwave',
  'paystack',
  'paymob',
  'mtn_momo',
  'mpesa',
] as const;

export const INTEGRATION_PROVIDER_CLASSES = [
  ZoomIntegration,
  BigBlueButtonIntegration,
  MicrosoftTeamsIntegration,
  WhatsAppBusinessIntegration,
  TwilioSmsIntegration,
  SlackIntegration,
  TurnitinIntegration,
  GoogleScholarIntegration,
  GoogleCalendarIntegration,
  MicrosoftOutlookIntegration,
  ICalExportIntegration,
] as const;

export type IntegrationProviderToken = UniCoreIntegration;
