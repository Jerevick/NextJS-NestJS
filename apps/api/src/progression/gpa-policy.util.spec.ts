import type { EnrollmentForGpa } from './gpa-policy.util';
import {
  computeCgpaFromContributions,
  contributionsPerRepeatedCoursePolicy,
} from './gpa-policy.util';

function row(
  courseId: string,
  start: string,
  creditHours: number,
  gp: number | null,
  status = 'COMPLETED',
): EnrollmentForGpa {
  return {
    courseId,
    semesterStart: new Date(start),
    creditHours,
    gradePoints: gp,
    status,
  };
}

describe('contributionsPerRepeatedCoursePolicy', () => {
  it('LAST_ATTEMPT uses the chronologically latest graded attempt', () => {
    const list = [
      row('c1', '2024-01-01', 3, 2.0),
      row('c1', '2024-06-01', 3, 3.7),
      row('c1', '2025-01-01', 3, null),
    ];
    const out = contributionsPerRepeatedCoursePolicy(list, 'LAST_ATTEMPT');
    expect(out).toEqual([
      expect.objectContaining({ courseId: 'c1', gradePoints: 3.7, creditHours: 3 }),
    ]);
  });

  it('BEST_OF_ATTEMPTS picks highest grade points', () => {
    const list = [row('c1', '2024-01-01', 3, 2.5), row('c1', '2024-09-01', 3, 3.9)];
    const out = contributionsPerRepeatedCoursePolicy(list, 'BEST_OF_ATTEMPTS');
    expect(out[0]?.gradePoints).toBe(3.9);
  });

  it('FIRST_ATTEMPT_ONLY uses earliest graded enrollment', () => {
    const list = [row('c1', '2024-01-01', 3, 1.8), row('c1', '2024-06-01', 3, 4.0)];
    const out = contributionsPerRepeatedCoursePolicy(list, 'FIRST_ATTEMPT_ONLY');
    expect(out[0]?.gradePoints).toBe(1.8);
  });

  it('computeCgpaFromContributions aggregates weighted GPA', () => {
    const contribs = [
      { courseId: 'a', gradePoints: 4, creditHours: 3 },
      { courseId: 'b', gradePoints: 2, creditHours: 3 },
    ];
    const cg = computeCgpaFromContributions(contribs);
    expect(cg.gpa).toBe(3);
    expect(cg.creditsGraded).toBe(6);
  });
});
