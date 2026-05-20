/** Keys whose values must not be returned to API clients after configure. */
const SECRET_SETTING_KEYS = new Set([
  'clientSecret',
  'accessToken',
  'apiKey',
  'secret',
  'sharedSecret',
  'webhookSecret',
  'password',
  'incomingWebhookUrl',
]);

export function maskIntegrationSettings(
  settings: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(settings)) {
    if (SECRET_SETTING_KEYS.has(key)) {
      out[key] = value && String(value).trim() ? '••••••••' : '';
      continue;
    }
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      out[key] = maskIntegrationSettings(value as Record<string, unknown>);
    } else {
      out[key] = value;
    }
  }
  return out;
}

/** Maps integration codes to customization settings keys (legacy UI sync). */
export function legacyCustomizationPatchForIntegration(
  code: string,
  enabled: boolean,
  settings: Record<string, unknown>,
): Record<string, unknown> | null {
  if (code === 'zoom') return { 'integrations.zoom': { enabled, ...settings } };
  if (code === 'whatsapp') return { 'integrations.whatsapp': { enabled, ...settings } };
  if (code === 'google_calendar') {
    return { 'integrations.calendar': { provider: enabled ? 'google' : 'none' } };
  }
  if (code === 'microsoft_outlook') {
    return { 'integrations.calendar': { provider: enabled ? 'outlook' : 'none' } };
  }
  if (code === 'stripe' || code === 'flutterwave' || code === 'paystack' || code === 'paymob') {
    return enabled ? { paymentGateway: code } : null;
  }
  return null;
}
