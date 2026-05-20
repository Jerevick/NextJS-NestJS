import { auth } from '@/auth';
import { GuardianDashboardSummary } from '@/components/guardian-portal/guardian-dashboard-summary';
import { GuardianStudentCard } from '@/components/guardian-portal/guardian-student-card';
import { GUARDIAN_PORTAL } from '@/components/guardian-portal/guardian-portal-styles';
import { fetchPortalJson } from '@/lib/portal-api';

type GuardianListPayload = {
  visibility: { academic: boolean; finance: boolean; attendance: boolean };
  summary: {
    totalStudents: number;
    onTrackCount: number;
    outstandingBalanceCount: number;
    inactiveCount: number;
  };
  students: Array<{
    studentId: string;
    studentNumber: string;
    displayName: string;
    enrollmentStatus: string;
    program: { code: string; name: string };
    entity: { code: string; name: string };
    cgpa: number | null;
    balance: number | null;
    alerts: { outstandingBalance: boolean; inactive: boolean };
  }>;
};

function VisibilityPills({ visibility }: { visibility: GuardianListPayload['visibility'] }) {
  const pills = [
    visibility.academic ? 'Academic' : null,
    visibility.finance ? 'Finance' : null,
    visibility.attendance ? 'Attendance' : null,
  ].filter(Boolean) as string[];

  if (pills.length === 0) {
    return (
      <p style={{ color: GUARDIAN_PORTAL.muted, fontSize: '0.88rem', marginTop: '0.5rem' }}>
        No data categories are enabled for guardians at this institution.
      </p>
    );
  }

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: '0.5rem' }}>
      {pills.map((label) => (
        <span
          key={label}
          style={{
            fontSize: '0.75rem',
            fontWeight: 600,
            padding: '0.2rem 0.5rem',
            borderRadius: 999,
            background: '#dbeafe',
            color: GUARDIAN_PORTAL.accent,
          }}
        >
          {label} visible
        </span>
      ))}
    </div>
  );
}

export default async function GuardianDashboardPage() {
  const session = await auth();
  if (!session?.accessToken) {
    return null;
  }

  const res = await fetchPortalJson<GuardianListPayload>('/portal/guardian/students', session);

  return (
    <>
      <h1 style={{ margin: 0, fontSize: '1.65rem', color: GUARDIAN_PORTAL.text }}>
        Family dashboard
      </h1>
      <p style={{ color: GUARDIAN_PORTAL.muted, fontSize: '1rem', maxWidth: 560 }}>
        Monitor academic standing, balances, and attendance for students linked to your account.
      </p>

      {!res.ok ? (
        <p style={{ color: '#b91c1c' }}>Could not load students ({res.status}).</p>
      ) : (
        <>
          <VisibilityPills visibility={res.data.visibility} />
          <GuardianDashboardSummary {...res.data.summary} />
          {res.data.students.length === 0 ? (
            <p style={{ color: GUARDIAN_PORTAL.muted, marginTop: '1.5rem' }}>
              No linked students found. Ask the institution to add your email or user id to a
              student guardian record.
            </p>
          ) : (
            <div
              style={{
                display: 'grid',
                gap: '1rem',
                marginTop: '1.5rem',
                gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
              }}
            >
              {res.data.students.map((s) => (
                <GuardianStudentCard
                  key={s.studentId}
                  student={s}
                  visibility={res.data.visibility}
                />
              ))}
            </div>
          )}
        </>
      )}
    </>
  );
}
