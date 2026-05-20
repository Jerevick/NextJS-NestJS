import { auth } from '@/auth';
import { CgpaTrendChart } from '@/components/student-portal/cgpa-trend-chart';
import { StudentPortalPageHeader } from '@/components/student-portal/student-portal-page-header';
import { STUDENT_PORTAL } from '@/components/student-portal/student-portal-styles';
import { fetchPortalJson } from '@/lib/portal-api';

type GradesPayload = {
  cumulativeGpa: number | null;
  creditHoursGradedUsed: number;
  policy: string;
  gpaTrend: Array<{
    semesterId: string;
    semesterName: string;
    termGpa: number | null;
    cumulativeGpa: number | null;
  }>;
  semesters: Array<{
    semesterId: string;
    semesterName: string;
    courses: Array<{
      courseCode: string;
      courseTitle: string;
      creditHours: number;
      grade: unknown;
      status: string;
    }>;
  }>;
};

function formatGrade(grade: unknown): string {
  if (grade == null) {
    return '—';
  }
  if (typeof grade === 'string') {
    return grade;
  }
  if (typeof grade === 'object' && grade !== null && 'letter' in grade) {
    const l = (grade as { letter?: unknown }).letter;
    return typeof l === 'string' ? l : JSON.stringify(grade);
  }
  return String(grade);
}

function semesterGpa(courses: GradesPayload['semesters'][number]['courses']): number | null {
  const graded = courses.filter((c) => c.grade != null);
  if (graded.length === 0) {
    return null;
  }
  let points = 0;
  let credits = 0;
  for (const c of graded) {
    const g = c.grade;
    let gp: number | null = null;
    if (typeof g === 'object' && g !== null && 'gpaPoints' in g) {
      const v = (g as { gpaPoints?: unknown }).gpaPoints;
      if (typeof v === 'number') {
        gp = v;
      }
    }
    if (gp == null) {
      continue;
    }
    points += gp * c.creditHours;
    credits += c.creditHours;
  }
  return credits > 0 ? points / credits : null;
}

export default async function MyGradesPage() {
  const session = await auth();
  if (!session?.accessToken) {
    return null;
  }

  const res = await fetchPortalJson<GradesPayload>('/portal/student/grades', session);

  return (
    <div style={{ padding: '2rem 2.5rem', maxWidth: 960 }}>
      <StudentPortalPageHeader
        title="My grades"
        description="Released grades by semester. Contact the registrar to dispute a grade."
      />

      {!res.ok ? (
        <p style={{ color: '#b91c1c' }}>Could not load grades ({res.status}).</p>
      ) : (
        <>
          <div
            style={{
              marginTop: '0.5rem',
              display: 'flex',
              flexWrap: 'wrap',
              gap: '1rem',
              alignItems: 'stretch',
            }}
          >
            <div
              style={{
                padding: '1rem 1.25rem',
                background: '#fff',
                borderRadius: 12,
                border: `1px solid ${STUDENT_PORTAL.border}`,
                flex: '0 0 auto',
              }}
            >
              <div style={{ fontSize: '0.75rem', color: STUDENT_PORTAL.muted }}>Cumulative GPA</div>
              <div style={{ fontSize: '2rem', fontWeight: 700, color: STUDENT_PORTAL.teal }}>
                {res.data.cumulativeGpa != null ? res.data.cumulativeGpa.toFixed(2) : '—'}
              </div>
              <div style={{ fontSize: '0.85rem', color: STUDENT_PORTAL.muted }}>
                Policy: {res.data.policy} · {res.data.creditHoursGradedUsed} cr graded
              </div>
            </div>
          </div>

          {res.data.gpaTrend.length > 0 ? (
            <section
              style={{
                marginTop: '1.5rem',
                padding: '1.15rem 1.25rem',
                background: '#fff',
                borderRadius: 12,
                border: `1px solid ${STUDENT_PORTAL.border}`,
              }}
            >
              <h2
                style={{ margin: '0 0 0.75rem', fontSize: '1.05rem', color: STUDENT_PORTAL.text }}
              >
                GPA trend
              </h2>
              <CgpaTrendChart
                points={res.data.gpaTrend.map((p) => ({
                  semesterName: p.semesterName,
                  termGpa: p.termGpa,
                  cumulativeGpa: p.cumulativeGpa,
                }))}
              />
            </section>
          ) : null}

          {res.data.semesters.map((sem) => {
            const sgpa = semesterGpa(sem.courses);
            return (
              <section key={sem.semesterId} style={{ marginTop: '2rem' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
                  <h2 style={{ fontSize: '1.05rem', color: STUDENT_PORTAL.text, margin: 0 }}>
                    {sem.semesterName}
                  </h2>
                  {sgpa != null ? (
                    <span
                      style={{ fontSize: '0.88rem', color: STUDENT_PORTAL.teal, fontWeight: 600 }}
                    >
                      Term GPA {sgpa.toFixed(2)}
                    </span>
                  ) : null}
                </div>
                <table
                  style={{
                    width: '100%',
                    borderCollapse: 'collapse',
                    background: '#fff',
                    borderRadius: 10,
                    overflow: 'hidden',
                    border: `1px solid ${STUDENT_PORTAL.border}`,
                    marginTop: 8,
                  }}
                >
                  <thead>
                    <tr style={{ background: '#f1f5f9', textAlign: 'left', fontSize: '0.85rem' }}>
                      <th style={{ padding: '0.65rem 0.85rem' }}>Course</th>
                      <th style={{ padding: '0.65rem 0.85rem' }}>Credits</th>
                      <th style={{ padding: '0.65rem 0.85rem' }}>Grade</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sem.courses.map((c) => (
                      <tr key={`${sem.semesterId}-${c.courseCode}`}>
                        <td style={{ padding: '0.65rem 0.85rem' }}>
                          <strong>{c.courseCode}</strong> {c.courseTitle}
                        </td>
                        <td style={{ padding: '0.65rem 0.85rem' }}>{c.creditHours}</td>
                        <td style={{ padding: '0.65rem 0.85rem', fontWeight: 600 }}>
                          {formatGrade(c.grade)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            );
          })}
        </>
      )}
    </div>
  );
}
