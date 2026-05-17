import type { GpaRepeatPolicy } from '@prisma/client';
import { GpaComputationService } from './gpa-computation.service';

describe('GpaComputationService', () => {
  const svc = new GpaComputationService();

  it('reads grade points JSON', () => {
    expect(svc.readGradePointsFromJson({ gradePoints: 3.5 })).toBe(3.5);
    expect(svc.readGradePointsFromJson(null)).toBeNull();
  });

  it('summarizes with repeat policy', () => {
    const rows = svc.rowsFromEnrollments([
      {
        grade: { gradePoints: 2 },
        status: 'COMPLETED',
        semester: { startDate: new Date('2024-01-01') },
        section: { course: { id: 'c1', creditHours: 3 } },
      },
      {
        grade: { gradePoints: 3.7 },
        status: 'COMPLETED',
        semester: { startDate: new Date('2024-06-01') },
        section: { course: { id: 'c1', creditHours: 3 } },
      },
    ]);
    const s = svc.summarizeWithPolicy(rows, 'LAST_ATTEMPT' as GpaRepeatPolicy);
    expect(s.cumulativeGpa).toBe(3.7);
  });
});
