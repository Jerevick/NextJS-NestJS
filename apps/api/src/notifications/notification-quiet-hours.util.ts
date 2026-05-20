import type { UserQuietHours } from './notification-user-preferences.util';

function parseTimeToMinutes(value: string): number {
  const [h, m] = value.split(':');
  const hour = parseInt(h ?? '0', 10);
  const minute = parseInt(m ?? '0', 10);
  return hour * 60 + minute;
}

function currentMinutesInTimezone(timezone: string, now = new Date()): number {
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const parts = fmt.formatToParts(now);
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? 0);
  const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? 0);
  return hour * 60 + minute;
}

/** True when local time in `timezone` falls within quiet hours window. */
export function isWithinQuietHours(
  quietHours: UserQuietHours,
  timezone: string,
  now = new Date(),
): boolean {
  if (!quietHours.start || !quietHours.end) {
    return false;
  }
  const nowMins = currentMinutesInTimezone(timezone, now);
  const startMins = parseTimeToMinutes(quietHours.start);
  const endMins = parseTimeToMinutes(quietHours.end);

  if (startMins <= endMins) {
    return nowMins >= startMins && nowMins < endMins;
  }
  return nowMins >= startMins || nowMins < endMins;
}
