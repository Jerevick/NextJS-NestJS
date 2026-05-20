import { auth } from '@/auth';
import { StudentPortalPageHeader } from '@/components/student-portal/student-portal-page-header';
import { STUDENT_PORTAL } from '@/components/student-portal/student-portal-styles';
import { fetchPortalJson } from '@/lib/portal-api';

type AttendancePayload = {
  totalSessions: number;
  byStatus: Record<string, number>;
  bySection: Array<{
    sectionId: string;
    total: number;
    counts: Record<string, number>;
    courseCode: string | null;
    courseTitle: string | null;
  }>;
};

const WARN_THRESHOLD = 0.75;

export default async function MyAttendancePage() {
  const session = await auth();
  if (!session?.accessToken) {
    return null;
  }

  const res = await fetchPortalJson<AttendancePayload>('/portal/student/attendance', session);

  return (
    <div style={{ padding: '2rem 2.5rem', maxWidth: 880 }}>
      <StudentPortalPageHeader
        title="My attendance"
        description="Per-course attendance summary. Courses below 75% present are highlighted."
      />

      {!res.ok ? (
        <p style={{ color: '#b91c1c' }}>Could not load attendance ({res.status}).</p>
      ) : (
        <>
          <div
            style={{
              marginTop: '0.5rem',
              padding: '1rem',
              background: '#fff',
              borderRadius: 12,
              border: `1px solid ${STUDENT_PORTAL.border}`,
            }}
          >
            <strong>{res.data.totalSessions}</strong> sessions recorded
            <div style={{ marginTop: 8, fontSize: '0.9rem', color: STUDENT_PORTAL.muted }}>
              {Object.entries(res.data.byStatus)
                .map(([k, v]) => `${k}: ${v}`)
                .join(' · ')}
            </div>
          </div>

          <section style={{ marginTop: '1.5rem' }}>
            <h2 style={{ fontSize: '1.05rem' }}>By course</h2>
            {res.data.bySection.length === 0 ? (
              <p style={{ color: STUDENT_PORTAL.muted }}>No attendance records yet.</p>
            ) : (
              res.data.bySection.map((sec) => {
                const present = sec.counts.PRESENT ?? 0;
                const rate = sec.total > 0 ? present / sec.total : 0;
                const low = rate < WARN_THRESHOLD && sec.total >= 4;
                const label =
                  sec.courseCode && sec.courseTitle
                    ? `${sec.courseCode} — ${sec.courseTitle}`
                    : `Section ${sec.sectionId.slice(0, 8)}…`;
                return (
                  <div
                    key={sec.sectionId}
                    style={{
                      marginBottom: 12,
                      padding: '0.85rem 1rem',
                      borderRadius: 10,
                      background: low ? '#fff7ed' : '#fff',
                      border: `1px solid ${low ? '#fdba74' : STUDENT_PORTAL.border}`,
                    }}
                  >
                    <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>
                      {label}
                      {low ? (
                        <span style={{ color: '#c2410c', marginLeft: 8, fontSize: '0.85rem' }}>
                          Below 75% attendance
                        </span>
                      ) : null}
                    </div>
                    <div
                      style={{
                        marginTop: 8,
                        height: 8,
                        borderRadius: 4,
                        background: '#e2e8f0',
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          width: `${Math.round(rate * 100)}%`,
                          height: '100%',
                          background: low ? '#ea580c' : STUDENT_PORTAL.teal,
                        }}
                      />
                    </div>
                    <div style={{ fontSize: '0.85rem', color: STUDENT_PORTAL.muted, marginTop: 6 }}>
                      {Math.round(rate * 100)}% present ({present}/{sec.total})
                    </div>
                  </div>
                );
              })
            )}
          </section>
        </>
      )}
    </div>
  );
}
