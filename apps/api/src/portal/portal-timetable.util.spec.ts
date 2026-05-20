import { buildTodaySchedule } from './portal-timetable.util';

describe('buildTodaySchedule', () => {
  it('returns slots for today weekday sorted by start time', () => {
    const monday = new Date('2026-05-18T12:00:00'); // Monday
    const items = buildTodaySchedule(
      [
        {
          section: {
            schedule: { slots: [{ day: 'MON', start: '10:00', end: '11:00' }] },
            room: 'B201',
            course: { code: 'CS101', title: 'Intro CS' },
          },
        },
        {
          section: {
            schedule: { slots: [{ day: 'MON', start: '09:00', end: '09:50' }] },
            room: 'A101',
            course: { code: 'MATH', title: 'Calculus' },
          },
        },
      ],
      monday,
    );
    expect(items).toHaveLength(2);
    expect(items[0]!.courseCode).toBe('MATH');
    expect(items[1]!.courseCode).toBe('CS101');
    expect(items[0]!.room).toBe('A101');
  });
});
