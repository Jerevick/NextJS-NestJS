export type UserQuietHours = {
  start?: string;
  end?: string;
};

export type UserNotificationPreferences = {
  digestMode?: boolean;
  quietHours?: UserQuietHours;
  timezone?: string;
};

function readPreferencesRoot(profile: unknown): Record<string, unknown> | null {
  if (!profile || typeof profile !== 'object' || Array.isArray(profile)) {
    return null;
  }
  const root = profile as Record<string, unknown>;
  const prefs = root.preferences;
  if (prefs && typeof prefs === 'object' && !Array.isArray(prefs)) {
    return prefs as Record<string, unknown>;
  }
  return null;
}

export function readUserTimezone(profile: unknown): string {
  if (!profile || typeof profile !== 'object' || Array.isArray(profile)) {
    return 'UTC';
  }
  const root = profile as Record<string, unknown>;
  const prefs = readPreferencesRoot(profile);
  const tz = prefs?.timezone ?? root.timezone;
  if (typeof tz === 'string' && tz.trim()) {
    try {
      Intl.DateTimeFormat(undefined, { timeZone: tz.trim() });
      return tz.trim();
    } catch {
      return 'UTC';
    }
  }
  return 'UTC';
}

export function readUserQuietHours(profile: unknown): UserQuietHours | null {
  if (!profile || typeof profile !== 'object' || Array.isArray(profile)) {
    return null;
  }
  const root = profile as Record<string, unknown>;
  const prefs = readPreferencesRoot(profile);
  const notif = prefs?.notifications;
  const fromPrefs =
    notif && typeof notif === 'object' && !Array.isArray(notif)
      ? (notif as Record<string, unknown>).quietHours
      : undefined;
  const qh = fromPrefs ?? root.quietHours;
  if (!qh || typeof qh !== 'object' || Array.isArray(qh)) {
    return null;
  }
  const q = qh as Record<string, unknown>;
  const start = typeof q.start === 'string' ? q.start : undefined;
  const end = typeof q.end === 'string' ? q.end : undefined;
  if (!start || !end) return null;
  return { start, end };
}

/** Hourly digest for LOW-priority email/sms/push (in-app stays immediate). */
export function isDigestModeEnabled(profile: unknown): boolean {
  const prefs = readPreferencesRoot(profile);
  const notif = prefs?.notifications;
  if (notif && typeof notif === 'object' && !Array.isArray(notif)) {
    const dm = (notif as Record<string, unknown>).digestMode;
    if (dm === true) return true;
    if (dm === false) return false;
  }
  if (!profile || typeof profile !== 'object' || Array.isArray(profile)) {
    return false;
  }
  const root = profile as Record<string, unknown>;
  const legacy = root.notifications;
  if (legacy && typeof legacy === 'object' && !Array.isArray(legacy)) {
    return (legacy as Record<string, unknown>).digestMode === true;
  }
  return false;
}
