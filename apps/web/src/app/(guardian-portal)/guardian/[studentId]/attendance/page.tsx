import Link from 'next/link';
import { notFound } from 'next/navigation';
import { auth } from '@/auth';
import { GUARDIAN_PORTAL } from '@/components/guardian-portal/guardian-portal-styles';
import { fetchPortalJson } from '@/lib/portal-api';

type AttendancePayload = {
  totalSessions: number;
  byStatus: Record<string, number>;
  bySection: Array<{ sectionId: string; total: number; counts: Record<string, number> }>;
};

export default async function GuardianStudentAttendancePage({
  params,
}: {
  params: Promise<{ studentId: string }>;
}) {
  const { studentId } = await params;
  const session = await auth();
  if (!session?.accessToken) {
    return null;
  }

  const res = await fetchPortalJson<AttendancePayload>(
    `/portal/guardian/students/${encodeURIComponent(studentId)}/attendance`,
    session,
  );

  if (res.status === 404) {
    notFound();
  }

  return (
    <>
      <Link
        href="/dashboard/guardian/dashboard"
        style={{ color: GUARDIAN_PORTAL.accent, textDecoration: 'none' }}
      >
        ← All students
      </Link>
      <h1 style={{ margin: '0.75rem 0 0', fontSize: '1.4rem' }}>Attendance</h1>

      {!res.ok ? (
        <p style={{ color: '#b91c1c', marginTop: '1rem' }}>
          {res.status === 403
            ? 'Attendance is not shared with guardians at this institution.'
            : `Could not load attendance (${res.status}).`}
        </p>
      ) : (
        <>
          <p style={{ color: GUARDIAN_PORTAL.muted, marginTop: '0.5rem' }}>
            {res.data.totalSessions} sessions on record
          </p>
          {res.data.bySection.map((sec) => {
            const present = sec.counts.PRESENT ?? 0;
            const rate = sec.total > 0 ? present / sec.total : 0;
            return (
              <div
                key={sec.sectionId}
                style={{
                  marginTop: 12,
                  padding: '0.85rem 1rem',
                  background: GUARDIAN_PORTAL.card,
                  border: `1px solid ${GUARDIAN_PORTAL.border}`,
                  borderRadius: 10,
                }}
              >
                Section {sec.sectionId.slice(0, 8)}… — {Math.round(rate * 100)}% present
              </div>
            );
          })}
        </>
      )}
    </>
  );
}
