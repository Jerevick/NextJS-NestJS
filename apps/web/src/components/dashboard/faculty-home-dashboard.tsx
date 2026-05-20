import Link from 'next/link';
import { fetchDashboardJson } from '@/lib/dashboard-api';
import type { Session } from 'next-auth';

const C = {
  text: '#0f172a',
  muted: '#64748b',
  border: '#e2e8f0',
  accent: '#2563eb',
  navy: '#0f1729',
};

type FacultyPayload = {
  teaching: {
    sectionCount: number;
    courses: Array<{
      sectionId: string;
      courseCode: string;
      courseTitle: string;
      semesterName: string;
      enrolledCount: number;
      maxEnrollment: number;
      room: string | null;
      lmsCourseInstanceId: string | null;
      lmsPublished: boolean;
    }>;
  };
  workflow: {
    pendingCount: number;
    preview: Array<{
      id: string;
      definitionName: string;
      entityCode: string;
      dueAt: string;
    }>;
  };
};

export async function FacultyHomeDashboard({
  session,
}: {
  session: Session & { accessToken: string };
}) {
  const res = await fetchDashboardJson<FacultyPayload>('/dashboard/faculty', session);

  if (!res.ok) {
    return (
      <main style={{ padding: '2rem' }}>
        <h1>Faculty dashboard</h1>
        <p style={{ color: '#b91c1c' }}>Could not load dashboard ({res.status}).</p>
      </main>
    );
  }

  const d = res.data;

  return (
    <main style={{ padding: '2rem 2.5rem', maxWidth: 1100, fontFamily: 'system-ui' }}>
      <h1 style={{ margin: 0, fontSize: '1.75rem', color: C.text }}>Teaching overview</h1>
      <p style={{ color: C.muted, marginTop: '0.35rem' }}>
        {d.teaching.sectionCount} section{d.teaching.sectionCount === 1 ? '' : 's'} assigned to you
      </p>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          gap: '0.75rem',
          marginTop: '1.25rem',
        }}
      >
        <div
          style={{
            padding: '0.85rem 1rem',
            background: '#fff',
            border: `1px solid ${C.border}`,
            borderRadius: 10,
          }}
        >
          <div style={{ fontSize: '0.72rem', color: C.muted }}>SECTIONS</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{d.teaching.sectionCount}</div>
        </div>
        {d.workflow.pendingCount > 0 ? (
          <Link
            href="/workflow/inbox"
            style={{
              padding: '0.85rem 1rem',
              background: '#fff7ed',
              border: '1px solid #fdba74',
              borderRadius: 10,
              textDecoration: 'none',
              color: C.text,
            }}
          >
            <div style={{ fontSize: '0.72rem', color: C.muted }}>APPROVALS</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{d.workflow.pendingCount}</div>
          </Link>
        ) : null}
      </div>

      <section style={{ marginTop: '1.75rem' }}>
        <h2 style={{ fontSize: '1.05rem' }}>My courses</h2>
        {d.teaching.courses.length === 0 ? (
          <p style={{ color: C.muted }}>No sections assigned yet.</p>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
              gap: '0.75rem',
              marginTop: '0.65rem',
            }}
          >
            {d.teaching.courses.map((c) => (
              <article
                key={c.sectionId}
                style={{
                  padding: '1rem',
                  background: '#fff',
                  border: `1px solid ${C.border}`,
                  borderRadius: 12,
                }}
              >
                <div style={{ fontWeight: 700 }}>
                  {c.courseCode} — {c.courseTitle}
                </div>
                <div style={{ fontSize: '0.85rem', color: C.muted, marginTop: 4 }}>
                  {c.semesterName} · {c.enrolledCount}/{c.maxEnrollment} enrolled
                  {c.room ? ` · ${c.room}` : ''}
                </div>
                <div style={{ marginTop: '0.75rem', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {c.lmsCourseInstanceId ? (
                    <Link
                      href={`/teach/${c.lmsCourseInstanceId}`}
                      style={{ color: C.accent, fontWeight: 600, fontSize: '0.88rem' }}
                    >
                      Open teach workspace →
                    </Link>
                  ) : (
                    <span style={{ fontSize: '0.82rem', color: C.muted }}>No LMS shell yet</span>
                  )}
                  {c.lmsCourseInstanceId ? (
                    <span
                      style={{
                        fontSize: '0.7rem',
                        padding: '0.15rem 0.4rem',
                        borderRadius: 4,
                        background: c.lmsPublished ? '#dcfce7' : '#f1f5f9',
                      }}
                    >
                      {c.lmsPublished ? 'Live' : 'Draft'}
                    </span>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {d.workflow.preview.length > 0 ? (
        <section style={{ marginTop: '1.75rem' }}>
          <h2 style={{ fontSize: '1.05rem' }}>Pending approvals</h2>
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {d.workflow.preview.map((w) => (
              <li
                key={w.id}
                style={{
                  padding: '0.65rem 0',
                  borderBottom: `1px solid ${C.border}`,
                  fontSize: '0.9rem',
                }}
              >
                <Link href="/workflow/inbox" style={{ color: C.accent }}>
                  {w.definitionName}
                </Link>
                <span style={{ color: C.muted }}> · {w.entityCode}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <p style={{ marginTop: '1.5rem' }}>
        <Link href="/teach/attendance-qr" style={{ color: C.accent, fontWeight: 600 }}>
          Attendance QR generator →
        </Link>
      </p>
    </main>
  );
}
