/** Build iCalendar (RFC 5545) for approved leave blocks. */
export function buildLeaveIcsFeed(
  events: Array<{
    id: string;
    title: string;
    start: Date;
    end: Date;
    staffEmail?: string;
  }>,
  calendarName = 'UniCore Leave',
): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//UniCore//HR Leave//EN',
    `X-WR-CALNAME:${escapeIcs(calendarName)}`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
  ];
  for (const e of events) {
    const uid = `${e.id}@unicore-leave`;
    const dtStart = formatIcsDate(e.start);
    const dtEnd = formatIcsDate(addDays(e.end, 1));
    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${uid}`);
    lines.push(`DTSTAMP:${formatIcsDate(new Date())}`);
    lines.push(`DTSTART;VALUE=DATE:${dtStart}`);
    lines.push(`DTEND;VALUE=DATE:${dtEnd}`);
    lines.push(`SUMMARY:${escapeIcs(e.title)}`);
    if (e.staffEmail) lines.push(`ATTENDEE;CN=${escapeIcs(e.staffEmail)}:mailto:${e.staffEmail}`);
    lines.push('STATUS:CONFIRMED');
    lines.push('TRANSP:OPAQUE');
    lines.push('END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

function escapeIcs(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

function formatIcsDate(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}${m}${day}`;
}

function addDays(d: Date, days: number): Date {
  const out = new Date(d);
  out.setUTCDate(out.getUTCDate() + days);
  return out;
}

/** Google Calendar “create event” deep link for a blocked leave range. */
export function googleCalendarBlockUrl(title: string, start: Date, end: Date): string {
  const dates = `${formatIcsDate(start)}/${formatIcsDate(addDays(end, 1))}`;
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: title,
    dates,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/** Outlook web calendar compose link. */
export function outlookCalendarBlockUrl(title: string, start: Date, end: Date): string {
  const params = new URLSearchParams({
    path: '/calendar/action/compose',
    rru: 'addevent',
    subject: title,
    startdt: start.toISOString(),
    enddt: addDays(end, 1).toISOString(),
    allday: 'true',
  });
  return `https://outlook.office.com/calendar/0/deeplink/compose?${params.toString()}`;
}
