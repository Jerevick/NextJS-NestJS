import { parseTimetableConstraints } from './timetable-constraints.util';

describe('timetable-constraints.util', () => {
  it('excludes days and limits morning slots', () => {
    const parsed = parseTimetableConstraints(['No Friday', 'Morning only']);
    expect(parsed.excludeDays).toContain('FRI');
    expect(parsed.slotGrid?.days).not.toContain('FRI');
    expect(parsed.slotGrid?.dayEndMinutes).toBe(12 * 60);
  });
});
