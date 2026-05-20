import { buildGpaTrend } from './portal-gpa-trend.util';

describe('buildGpaTrend', () => {
  it('builds chronological term and cumulative GPAs', () => {
    const trend = buildGpaTrend([
      {
        semesterId: 's2',
        semesterName: 'Fall 2025',
        startDate: '2025-09-01',
        courses: [
          { creditHours: 3, grade: { gpaPoints: 3.5 } },
          { creditHours: 3, grade: { gpaPoints: 4 } },
        ],
      },
      {
        semesterId: 's1',
        semesterName: 'Spring 2025',
        startDate: '2025-01-10',
        courses: [{ creditHours: 4, grade: { gpaPoints: 3 } }],
      },
    ]);
    expect(trend).toHaveLength(2);
    expect(trend[0]!.semesterName).toBe('Spring 2025');
    expect(trend[0]!.termGpa).toBe(3);
    expect(trend[0]!.cumulativeGpa).toBe(3);
    expect(trend[1]!.termGpa).toBeCloseTo(3.75, 2);
    expect(trend[1]!.cumulativeGpa).toBeCloseTo(3.45, 2);
  });
});
