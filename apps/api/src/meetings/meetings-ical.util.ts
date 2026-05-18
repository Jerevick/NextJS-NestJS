function formatIcsDate(d: Date): string {
  return d
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}Z$/, 'Z');
}

export function buildMeetingIcs(input: {
  uid: string;
  title: string;
  scheduledAt: Date;
  durationMinutes: number;
  location?: string | null;
  meetingLink?: string | null;
  description?: string;
}): string {
  const start = input.scheduledAt;
  const end = new Date(start.getTime() + input.durationMinutes * 60_000);
  const loc = [input.location, input.meetingLink].filter(Boolean).join(' | ');
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//UniCore//Meetings//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${input.uid}@unicore`,
    `DTSTAMP:${formatIcsDate(new Date())}`,
    `DTSTART:${formatIcsDate(start)}`,
    `DTEND:${formatIcsDate(end)}`,
    `SUMMARY:${escapeIcs(input.title)}`,
  ];
  if (loc) lines.push(`LOCATION:${escapeIcs(loc)}`);
  if (input.description) lines.push(`DESCRIPTION:${escapeIcs(input.description)}`);
  if (input.meetingLink) lines.push(`URL:${input.meetingLink}`);
  lines.push('END:VEVENT', 'END:VCALENDAR');
  return lines.join('\r\n');
}

function escapeIcs(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}
