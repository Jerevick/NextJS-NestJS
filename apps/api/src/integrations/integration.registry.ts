import { Injectable } from '@nestjs/common';
import type { UniCoreIntegration } from './integration.types';
import {
  BigBlueButtonIntegration,
  GoogleCalendarIntegration,
  GoogleScholarIntegration,
  ICalExportIntegration,
  MicrosoftOutlookIntegration,
  MicrosoftTeamsIntegration,
  PaymentGatewayCatalogIntegration,
  PAYMENT_INTEGRATION_CODES,
  SlackIntegration,
  TurnitinIntegration,
  TwilioSmsIntegration,
  WhatsAppBusinessIntegration,
  ZoomIntegration,
} from './providers/integration.providers';

const PAYMENT_LABELS: Record<string, string> = {
  stripe: 'Stripe',
  flutterwave: 'Flutterwave',
  paystack: 'Paystack',
  paymob: 'Paymob',
  mtn_momo: 'MTN MoMo',
  mpesa: 'M-Pesa',
};

@Injectable()
export class IntegrationRegistry {
  private readonly byCode = new Map<string, UniCoreIntegration>();

  constructor(
    zoom: ZoomIntegration,
    bbb: BigBlueButtonIntegration,
    teams: MicrosoftTeamsIntegration,
    whatsapp: WhatsAppBusinessIntegration,
    twilio: TwilioSmsIntegration,
    slack: SlackIntegration,
    turnitin: TurnitinIntegration,
    scholar: GoogleScholarIntegration,
    gcal: GoogleCalendarIntegration,
    outlook: MicrosoftOutlookIntegration,
    ical: ICalExportIntegration,
  ) {
    for (const p of [
      zoom,
      bbb,
      teams,
      whatsapp,
      twilio,
      slack,
      turnitin,
      scholar,
      gcal,
      outlook,
      ical,
    ]) {
      this.byCode.set(p.code, p);
    }
    for (const code of PAYMENT_INTEGRATION_CODES) {
      const label = PAYMENT_LABELS[code] ?? code;
      this.byCode.set(code, new PaymentGatewayCatalogIntegration(code, label));
    }
  }

  get(code: string): UniCoreIntegration | undefined {
    return this.byCode.get(code);
  }

  list(): UniCoreIntegration[] {
    return [...this.byCode.values()];
  }
}
