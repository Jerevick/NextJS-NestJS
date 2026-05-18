import { buildLeaveIcsFeed, googleCalendarBlockUrl } from './staff-calendar.util';

describe('staff-calendar.util', () => {
  it('builds valid ics with one event', () => {
    const ics = buildLeaveIcsFeed([
      {
        id: 'lr1',
        title: 'Annual leave',
        start: new Date('2026-06-01'),
        end: new Date('2026-06-05'),
      },
    ]);
    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics).toContain('BEGIN:VEVENT');
    expect(ics).toContain('Annual leave');
  });

  it('builds google calendar url', () => {
    const url = googleCalendarBlockUrl('Leave', new Date('2026-01-01'), new Date('2026-01-03'));
    expect(url).toContain('calendar.google.com');
  });
});
