import { parseEntitySettings } from '../institution-entities/entity-settings.types';

export function isEntityBillingExempt(settings: unknown): boolean {
  return parseEntitySettings(settings).billingClassification === 'EXEMPT';
}
