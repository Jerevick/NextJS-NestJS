import { Injectable } from '@nestjs/common';
import type { GpaRepeatPolicy } from '@prisma/client';
import {
  computeCgpaFromContributions,
  contributionsPerRepeatedCoursePolicy,
  type CourseGpaContribution,
  type EnrollmentForGpa,
} from './gpa-policy.util';

export type EnrollmentRowInput = {
  grade: unknown;
  status: string;
  semester: { startDate: Date };
  section: { course: { id: string; creditHours: number } };
};

/**
 * GPA aggregation with institution repeat policy (.cursorrules §15.5).
 */
@Injectable()
export class GpaComputationService {
  readGradePointsFromJson(grade: unknown): number | null {
    if (!grade || typeof grade !== 'object' || Array.isArray(grade)) {
      return null;
    }
    const g = grade as { gradePoints?: unknown };
    if (typeof g.gradePoints === 'number' && !Number.isNaN(g.gradePoints)) {
      return g.gradePoints;
    }
    return null;
  }

  rowsFromEnrollments(enrollments: EnrollmentRowInput[]): EnrollmentForGpa[] {
    return enrollments.map((e) => ({
      courseId: e.section.course.id,
      semesterStart: new Date(e.semester.startDate),
      creditHours: e.section.course.creditHours,
      gradePoints: this.readGradePointsFromJson(e.grade),
      status: e.status,
    }));
  }

  summarizeWithPolicy(
    rows: EnrollmentForGpa[],
    policy: GpaRepeatPolicy,
  ): {
    cumulativeGpa: number | null;
    creditHoursAttempted: number;
    creditHoursEarned: number;
    creditHoursGraded: number;
    contributions: CourseGpaContribution[];
  } {
    const contribs = contributionsPerRepeatedCoursePolicy(rows, policy);
    const cg = computeCgpaFromContributions(contribs);
    const creditHoursAttempted = rows.reduce((s, r) => s + r.creditHours, 0);
    return {
      cumulativeGpa: cg.gpa,
      creditHoursAttempted,
      creditHoursEarned: cg.creditHoursEarned,
      creditHoursGraded: cg.creditsGraded,
      contributions: contribs,
    };
  }
}
