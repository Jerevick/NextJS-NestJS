import type { GpaRepeatPolicy } from '@prisma/client';

export type EnrollmentForGpa = {
  courseId: string;
  semesterStart: Date;
  creditHours: number;
  gradePoints: number | null;
  status: string;
};

export type CourseGpaContribution = {
  courseId: string;
  gradePoints: number;
  creditHours: number;
};

/**
 * Select one contribution per repeated course according to Phase 19 / `.cursorrules` §15.5.
 */
export function contributionsPerRepeatedCoursePolicy(
  rows: EnrollmentForGpa[],
  policy: GpaRepeatPolicy,
): CourseGpaContribution[] {
  const byCourse = new Map<string, EnrollmentForGpa[]>();
  for (const r of rows) {
    const list = byCourse.get(r.courseId) ?? [];
    list.push(r);
    byCourse.set(r.courseId, list);
  }
  const contributions: CourseGpaContribution[] = [];
  for (const [courseId, listRaw] of byCourse) {
    const list = [...listRaw].sort((a, b) => a.semesterStart.getTime() - b.semesterStart.getTime());
    const ch = list[0]?.creditHours ?? 0;
    if (ch <= 0) continue;

    switch (policy) {
      case 'FIRST_ATTEMPT_ONLY': {
        const firstGraded = list.find((x) => x.gradePoints !== null);
        if (firstGraded?.gradePoints != null) {
          contributions.push({ courseId, gradePoints: firstGraded.gradePoints, creditHours: ch });
        }
        break;
      }
      case 'LAST_ATTEMPT': {
        const rev = [...list].reverse();
        const lastGraded = rev.find((x) => x.gradePoints !== null);
        if (lastGraded?.gradePoints != null) {
          contributions.push({ courseId, gradePoints: lastGraded.gradePoints, creditHours: ch });
        }
        break;
      }
      case 'ALL_ATTEMPTS_AVERAGE': {
        const graded = list.filter((x) => x.gradePoints !== null) as Array<
          EnrollmentForGpa & { gradePoints: number }
        >;
        if (graded.length === 0) break;
        let sum = 0;
        let denom = 0;
        for (const g of graded) {
          sum += g.gradePoints * g.creditHours;
          denom += g.creditHours;
        }
        if (denom > 0) {
          contributions.push({ courseId, gradePoints: sum / denom, creditHours: ch });
        }
        break;
      }
      case 'BEST_OF_ATTEMPTS':
      default: {
        let bestGp: number | null = null;
        for (const x of list) {
          if (x.gradePoints === null) continue;
          bestGp = bestGp === null || x.gradePoints > bestGp ? x.gradePoints : bestGp;
        }
        if (bestGp !== null) {
          contributions.push({ courseId, gradePoints: bestGp, creditHours: ch });
        }
        break;
      }
    }
  }
  return contributions;
}

/** Cumulative GPA and earned hours using selected course contributions — matches existing “pass ≥ 1.0 point” heuristic. */
export function computeCgpaFromContributions(contribs: CourseGpaContribution[]): {
  gpa: number | null;
  creditHoursAttempted: number;
  creditHoursEarned: number;
  creditsGraded: number;
} {
  let weighted = 0;
  let creditsGraded = 0;
  let creditHoursEarned = 0;
  let creditHoursAttempted = 0;
  for (const c of contribs) {
    creditHoursAttempted += c.creditHours;
    weighted += c.gradePoints * c.creditHours;
    creditsGraded += c.creditHours;
    if (c.gradePoints >= 1) {
      creditHoursEarned += c.creditHours;
    }
  }
  const gpa = creditsGraded > 0 ? Math.round((weighted / creditsGraded) * 100) / 100 : null;
  return { gpa, creditHoursAttempted, creditHoursEarned, creditsGraded };
}
