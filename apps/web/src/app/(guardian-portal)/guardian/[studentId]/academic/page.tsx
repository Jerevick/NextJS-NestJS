import Link from 'next/link';
import { notFound } from 'next/navigation';
import { auth } from '@/auth';
import { GUARDIAN_PORTAL } from '@/components/guardian-portal/guardian-portal-styles';
import { fetchPortalJson } from '@/lib/portal-api';

type AcademicPayload = {
  cumulativeGpa: number | null;
  creditHoursGradedUsed: number;
  enrollments: Array<{
    courseCode: string;
    courseTitle: string;
    grade: unknown;
    semesterName: string | null;
  }>;
};

function formatGrade(grade: unknown): string {
  if (grade == null) return '—';
  if (typeof grade === 'string') return grade;
  if (typeof grade === 'object' && grade !== null && 'letter' in grade) {
    const l = (grade as { letter?: unknown }).letter;
    return typeof l === 'string' ? l : JSON.stringify(grade);
  }
  return String(grade);
}

export default async function GuardianStudentAcademicPage({
  params,
}: {
  params: Promise<{ studentId: string }>;
}) {
  const { studentId } = await params;
  const session = await auth();
  if (!session?.accessToken) {
    return null;
  }

  const res = await fetchPortalJson<AcademicPayload>(
    `/portal/guardian/students/${encodeURIComponent(studentId)}/academic`,
    session,
  );

  if (res.status === 404) {
    notFound();
  }

  return (
    <>
      <Link
        href="/guardian/dashboard"
        style={{ color: GUARDIAN_PORTAL.accent, textDecoration: 'none' }}
      >
        ← All students
      </Link>
      <h1 style={{ margin: '0.75rem 0 0', fontSize: '1.4rem' }}>Academic record</h1>

      {!res.ok ? (
        <p style={{ color: '#b91c1c', marginTop: '1rem' }}>
          {res.status === 403
            ? 'Academic records are not shared with guardians at this institution.'
            : `Could not load record (${res.status}).`}
        </p>
      ) : (
        <>
          <p style={{ color: GUARDIAN_PORTAL.muted }}>
            CGPA: <strong>{res.data.cumulativeGpa?.toFixed(2) ?? '—'}</strong> (
            {res.data.creditHoursGradedUsed} credits)
          </p>
          <ul style={{ listStyle: 'none', padding: 0, marginTop: '1rem' }}>
            {res.data.enrollments.map((e, i) => (
              <li
                key={`${e.courseCode}-${i}`}
                style={{
                  padding: '0.85rem 1rem',
                  background: GUARDIAN_PORTAL.card,
                  border: `1px solid ${GUARDIAN_PORTAL.border}`,
                  borderRadius: 10,
                  marginBottom: 8,
                }}
              >
                <strong>{e.courseCode}</strong> {e.courseTitle}
                <div style={{ color: GUARDIAN_PORTAL.muted, fontSize: '0.95rem' }}>
                  {e.semesterName ?? 'Semester'} · Grade {formatGrade(e.grade)}
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}
