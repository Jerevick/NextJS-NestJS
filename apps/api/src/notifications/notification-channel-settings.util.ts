/** Institution `settings.notifications` — Phase 14.1 channel providers. */
export type InstitutionSmtpSettings = {
  host: string;
  port?: number;
  secure?: boolean;
  user?: string;
  pass?: string;
  from?: string;
};

export type InstitutionSmsProvider = 'twilio' | 'africas_talking';

export type InstitutionSmsSettings = {
  provider: InstitutionSmsProvider;
  accountSid?: string;
  authToken?: string;
  from?: string;
  apiKey?: string;
  username?: string;
};

export type InstitutionPushSettings = {
  projectId?: string;
  /** JSON string or parsed service account object */
  serviceAccountJson?: string | Record<string, unknown>;
};

export type InstitutionNotificationSettings = {
  smtp?: InstitutionSmtpSettings;
  sms?: InstitutionSmsSettings;
  push?: InstitutionPushSettings;
};

export function readNotificationSettings(settings: unknown): InstitutionNotificationSettings {
  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) {
    return {};
  }
  const root = settings as { notifications?: unknown };
  const n = root.notifications;
  if (!n || typeof n !== 'object' || Array.isArray(n)) {
    return {};
  }
  const raw = n as Record<string, unknown>;
  const out: InstitutionNotificationSettings = {};

  const smtp = raw.smtp;
  if (smtp && typeof smtp === 'object' && !Array.isArray(smtp)) {
    const s = smtp as Record<string, unknown>;
    if (typeof s.host === 'string' && s.host.trim()) {
      out.smtp = {
        host: s.host.trim(),
        port: typeof s.port === 'number' ? s.port : undefined,
        secure: s.secure === true,
        user: typeof s.user === 'string' ? s.user : undefined,
        pass: typeof s.pass === 'string' ? s.pass : undefined,
        from: typeof s.from === 'string' ? s.from : undefined,
      };
    }
  }

  const sms = raw.sms;
  if (sms && typeof sms === 'object' && !Array.isArray(sms)) {
    const s = sms as Record<string, unknown>;
    const provider =
      s.provider === 'africas_talking'
        ? 'africas_talking'
        : s.provider === 'twilio'
          ? 'twilio'
          : null;
    if (provider) {
      out.sms = {
        provider,
        accountSid: typeof s.accountSid === 'string' ? s.accountSid : undefined,
        authToken: typeof s.authToken === 'string' ? s.authToken : undefined,
        from: typeof s.from === 'string' ? s.from : undefined,
        apiKey: typeof s.apiKey === 'string' ? s.apiKey : undefined,
        username: typeof s.username === 'string' ? s.username : undefined,
      };
    }
  }

  const push = raw.push;
  if (push && typeof push === 'object' && !Array.isArray(push)) {
    const p = push as Record<string, unknown>;
    out.push = {
      projectId: typeof p.projectId === 'string' ? p.projectId : undefined,
      serviceAccountJson:
        typeof p.serviceAccountJson === 'string' ||
        (p.serviceAccountJson && typeof p.serviceAccountJson === 'object')
          ? (p.serviceAccountJson as string | Record<string, unknown>)
          : undefined,
    };
  }

  return out;
}

export function readUserPhone(profile: unknown): string | null {
  if (!profile || typeof profile !== 'object' || Array.isArray(profile)) {
    return null;
  }
  const p = profile as { phone?: unknown; mobile?: unknown };
  const raw = p.phone ?? p.mobile;
  if (typeof raw !== 'string' || !raw.trim()) {
    return null;
  }
  return raw.trim();
}

export function readUserFcmTokens(profile: unknown): string[] {
  if (!profile || typeof profile !== 'object' || Array.isArray(profile)) {
    return [];
  }
  const p = profile as { fcmToken?: unknown; fcmTokens?: unknown };
  if (typeof p.fcmToken === 'string' && p.fcmToken.trim()) {
    return [p.fcmToken.trim()];
  }
  if (Array.isArray(p.fcmTokens)) {
    return p.fcmTokens
      .filter((t): t is string => typeof t === 'string' && Boolean(t.trim()))
      .map((t) => t.trim());
  }
  return [];
}
