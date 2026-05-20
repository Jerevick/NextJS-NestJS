export type SemesterGradeRow = {
  semesterId: string;
  semesterName: string;
  startDate: Date | string;
  courses: Array<{ creditHours: number; grade: unknown }>;
};

export type GpaTrendPoint = {
  semesterId: string;
  semesterName: string;
  termGpa: number | null;
  cumulativeGpa: number | null;
};

function readGradePoints(grade: unknown): number | null {
  if (!grade || typeof grade !== 'object' || Array.isArray(grade)) {
    return null;
  }
  const g = grade as { gpaPoints?: unknown; gradePoints?: unknown };
  const v = g.gpaPoints ?? g.gradePoints;
  return typeof v === 'number' && !Number.isNaN(v) ? v : null;
}

/** Chronological term + running cumulative GPA from released grades. */
export function buildGpaTrend(semesters: SemesterGradeRow[]): GpaTrendPoint[] {
  const sorted = [...semesters].sort(
    (a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime(),
  );
  let cumPoints = 0;
  let cumCredits = 0;

  return sorted.map((sem) => {
    let termPoints = 0;
    let termCredits = 0;
    for (const c of sem.courses) {
      const gp = readGradePoints(c.grade);
      if (gp == null) {
        continue;
      }
      termPoints += gp * c.creditHours;
      termCredits += c.creditHours;
      cumPoints += gp * c.creditHours;
      cumCredits += c.creditHours;
    }
    return {
      semesterId: sem.semesterId,
      semesterName: sem.semesterName,
      termGpa: termCredits > 0 ? Math.round((termPoints / termCredits) * 100) / 100 : null,
      cumulativeGpa: cumCredits > 0 ? Math.round((cumPoints / cumCredits) * 100) / 100 : null,
    };
  });
}
