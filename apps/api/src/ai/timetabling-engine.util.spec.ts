import { generateTimetableOptions, validateTimetableAssignments } from './timetabling-engine.util';

describe('timetabling-engine.util', () => {
  const rooms = [
    { id: 'r1', capacity: 30 },
    { id: 'r2', capacity: 40 },
  ];

  it('produces conflict-free assignments', () => {
    const options = generateTimetableOptions({
      sections: [
        { id: 's1', courseCode: 'CS101', enrollments: 25, instructorId: 'f1' },
        { id: 's2', courseCode: 'CS102', enrollments: 20, instructorId: 'f2' },
      ],
      rooms,
      facultyAvailability: {
        f1: ['MON 08:00-18:00'],
        f2: ['TUE 08:00-18:00'],
      },
      slotGrid: { slotMinutes: 120, dayStartMinutes: 8 * 60, dayEndMinutes: 12 * 60 },
      maxOptions: 2,
    });
    expect(options.length).toBeGreaterThan(0);
    const best = options[0]!;
    expect(best.assignments).toHaveLength(2);
    const check = validateTimetableAssignments({ rooms }, best.assignments);
    expect(check.valid).toBe(true);
  });

  it('respects student overlap groups', () => {
    const options = generateTimetableOptions({
      sections: [
        { id: 's1', courseCode: 'A', enrollments: 10 },
        { id: 's2', courseCode: 'B', enrollments: 10 },
      ],
      rooms,
      studentOverlapGroups: [['s1', 's2']],
      slotGrid: { slotMinutes: 60, dayStartMinutes: 9 * 60, dayEndMinutes: 11 * 60 },
      maxOptions: 1,
    });
    expect(options[0]?.assignments).toHaveLength(2);
    const a = options[0]!.assignments[0]!;
    const b = options[0]!.assignments[1]!;
    expect(a.day !== b.day || a.startTime !== b.startTime).toBe(true);
  });
});
