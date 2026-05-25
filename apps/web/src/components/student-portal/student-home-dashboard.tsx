import Link from 'next/link';
import { STUDENT_PORTAL } from '@/components/student-portal/student-portal-styles';
import { fetchPortalJson } from '@/lib/portal-api';
import type { Session } from 'next-auth';

type DashboardPayload = {
  greeting: string;
  profile: { displayName: string; readOnly: boolean; enrollmentStatus: string };
  cgpa: number | null;
  creditHoursGraded: number;
  creditProgress: { completed: number; required: number };
  continueLearning: {
    courseInstanceId: string;
    courseCode: string;
    courseTitle: string;
    progressPercent: number;
    lessonId: string | null;
  } | null;
  dueSoon: Array<{
    courseInstanceId: string;
    courseCode: string;
    courseTitle: string;
    dueCount: number;
  }>;
  dueAssessments: Array<{
    id: string;
    title: string;
    type: string;
    dueDate: string;
    courseCode: string;
    courseTitle: string;
    courseInstanceId: string;
  }>;
  todaySchedule: Array<{
    courseCode: string;
    courseTitle: string;
    room: string | null;
    startLabel: string;
    endLabel: string;
  }>;
  academicTip: string | null;
  academicTipSource?: 'ai' | 'rules';
  announcements: Array<{
    id: string;
    title: string;
    body: string;
    createdAt: string;
    actionUrl: string | null;
  }>;
};

function formatDueDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffDays = Math.ceil((d.getTime() - now.getTime()) / 86_400_000);
  if (diffDays <= 0) {
    return 'Due today';
  }
  if (diffDays === 1) {
    return 'Due tomorrow';
  }
  return `Due ${d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}`;
}

export async function StudentHomeDashboard({
  session,
}: {
  session: Session & { accessToken: string };
}) {
  const res = await fetchPortalJson<DashboardPayload>('/portal/student/dashboard', session);

  if (!res.ok) {
    return (
      <div style={{ padding: '2rem 2.5rem' }}>
        <h1 style={{ color: STUDENT_PORTAL.text }}>Student home</h1>
        <p style={{ color: '#b91c1c' }}>Could not load dashboard ({res.status}).</p>
      </div>
    );
  }

  const d = res.data;
  const firstName = d.profile.displayName.split(' ')[0] || 'there';
  const continueHref = d.continueLearning
    ? d.continueLearning.lessonId
      ? `/lms/${d.continueLearning.courseInstanceId}/lessons/${d.continueLearning.lessonId}`
      : `/lms/${d.continueLearning.courseInstanceId}`
    : '/my-courses';

  const creditPct =
    d.creditProgress.required > 0
      ? Math.min(100, Math.round((d.creditProgress.completed / d.creditProgress.required) * 100))
      : 0;
  const cgpaRing = d.cgpa != null ? Math.min(100, (d.cgpa / 4) * 100) : 0;

  return (
    <div style={{ padding: '2rem 2.5rem', maxWidth: 1000 }}>
      <h1 style={{ margin: 0, fontSize: '1.85rem', color: STUDENT_PORTAL.text }}>
        {d.greeting}, {firstName}
      </h1>
      <p style={{ color: STUDENT_PORTAL.muted, marginTop: '0.35rem' }}>
        Status: <strong>{d.profile.enrollmentStatus}</strong>
        {d.profile.readOnly ? ' · Read-only mode' : null}
      </p>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '1rem',
          marginTop: '1.5rem',
        }}
      >
        <div
          style={{
            padding: '1.25rem',
            borderRadius: 14,
            background: '#fff',
            border: `1px solid ${STUDENT_PORTAL.border}`,
            display: 'flex',
            gap: '1rem',
            alignItems: 'center',
          }}
        >
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: '50%',
              background: `conic-gradient(${STUDENT_PORTAL.teal} 0deg, ${STUDENT_PORTAL.teal} ${cgpaRing * 3.6}deg, #e2e8f0 ${cgpaRing * 3.6}deg)`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
            aria-label="CGPA"
          >
            <span
              style={{
                width: 54,
                height: 54,
                borderRadius: '50%',
                background: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: '1.1rem',
                color: STUDENT_PORTAL.teal,
              }}
            >
              {d.cgpa != null ? d.cgpa.toFixed(2) : '—'}
            </span>
          </div>
          <div>
            <div
              style={{
                fontSize: '0.75rem',
                color: STUDENT_PORTAL.muted,
                textTransform: 'uppercase',
              }}
            >
              Cumulative GPA
            </div>
            <div style={{ fontSize: '0.85rem', color: STUDENT_PORTAL.muted, marginTop: 4 }}>
              {d.creditHoursGraded} credit hours graded
            </div>
          </div>
        </div>

        <div
          style={{
            padding: '1.25rem',
            borderRadius: 14,
            background: '#fff',
            border: `1px solid ${STUDENT_PORTAL.border}`,
          }}
        >
          <div
            style={{ fontSize: '0.75rem', color: STUDENT_PORTAL.muted, textTransform: 'uppercase' }}
          >
            Degree progress
          </div>
          <div
            style={{
              fontWeight: 700,
              fontSize: '1.35rem',
              color: STUDENT_PORTAL.text,
              marginTop: 4,
            }}
          >
            {d.creditProgress.completed} / {d.creditProgress.required} cr
          </div>
          <div
            style={{
              marginTop: 10,
              height: 8,
              borderRadius: 4,
              background: '#e2e8f0',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: `${creditPct}%`,
                height: '100%',
                background: STUDENT_PORTAL.teal,
              }}
            />
          </div>
          <div style={{ fontSize: '0.82rem', color: STUDENT_PORTAL.muted, marginTop: 6 }}>
            {creditPct}% of program credits graded
          </div>
        </div>

        {d.continueLearning ? (
          <div
            style={{
              padding: '1.25rem',
              borderRadius: 14,
              background: `linear-gradient(135deg, ${STUDENT_PORTAL.navy}, #1e3a5f)`,
              color: '#fff',
              gridColumn: 'span 2',
            }}
          >
            <div style={{ fontSize: '0.8rem', opacity: 0.85 }}>Continue learning</div>
            <div style={{ fontWeight: 700, fontSize: '1.15rem', marginTop: 6 }}>
              {d.continueLearning.courseCode} — {d.continueLearning.courseTitle}
            </div>
            <div style={{ marginTop: 8, fontSize: '0.9rem', opacity: 0.9 }}>
              {Math.round(d.continueLearning.progressPercent)}% complete
            </div>
            <Link
              href={continueHref}
              style={{
                display: 'inline-block',
                marginTop: '1rem',
                padding: '0.55rem 1rem',
                background: STUDENT_PORTAL.teal,
                color: '#fff',
                borderRadius: 8,
                textDecoration: 'none',
                fontWeight: 600,
                fontSize: '0.9rem',
              }}
            >
              Continue →
            </Link>
          </div>
        ) : null}
      </div>

      {d.academicTip ? (
        <div
          style={{
            marginTop: '1.25rem',
            padding: '1rem 1.15rem',
            borderRadius: 12,
            background: 'linear-gradient(90deg, #ecfdf5, #f0fdfa)',
            border: `1px solid ${STUDENT_PORTAL.teal}33`,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: '0.75rem',
              fontWeight: 700,
              color: STUDENT_PORTAL.teal,
              textTransform: 'uppercase',
            }}
          >
            Academic tip
            {d.academicTipSource === 'ai' ? (
              <span
                style={{
                  fontSize: '0.65rem',
                  fontWeight: 600,
                  padding: '0.15rem 0.4rem',
                  borderRadius: 4,
                  background: '#ccfbf1',
                  color: '#0f766e',
                  textTransform: 'none',
                }}
              >
                AI coach
              </span>
            ) : null}
          </div>
          <p style={{ margin: '0.35rem 0 0', color: STUDENT_PORTAL.text, lineHeight: 1.45 }}>
            {d.academicTip}
          </p>
        </div>
      ) : null}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '1.25rem',
          marginTop: '1.5rem',
        }}
      >
        <section>
          <h2 style={{ fontSize: '1.05rem', color: STUDENT_PORTAL.text, margin: 0 }}>
            Today&apos;s classes
          </h2>
          {d.todaySchedule.length === 0 ? (
            <p style={{ color: STUDENT_PORTAL.muted, fontSize: '0.9rem', marginTop: 8 }}>
              No classes scheduled today.
            </p>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0, margin: '0.65rem 0 0' }}>
              {d.todaySchedule.map((slot, i) => (
                <li
                  key={`${slot.courseCode}-${slot.startLabel}-${i}`}
                  style={{
                    padding: '0.75rem 1rem',
                    background: '#fff',
                    border: `1px solid ${STUDENT_PORTAL.border}`,
                    borderRadius: 10,
                    marginBottom: 8,
                  }}
                >
                  <div style={{ fontWeight: 600 }}>
                    {slot.startLabel} – {slot.endLabel}
                  </div>
                  <div style={{ fontSize: '0.9rem', marginTop: 2 }}>
                    {slot.courseCode} · {slot.courseTitle}
                  </div>
                  {slot.room ? (
                    <div style={{ fontSize: '0.82rem', color: STUDENT_PORTAL.muted }}>
                      Room {slot.room}
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h2 style={{ fontSize: '1.05rem', color: STUDENT_PORTAL.text, margin: 0 }}>
            Due in 7 days
          </h2>
          {d.dueAssessments.length === 0 ? (
            <p style={{ color: STUDENT_PORTAL.muted, fontSize: '0.9rem', marginTop: 8 }}>
              No open assessments due this week.
            </p>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0, margin: '0.65rem 0 0' }}>
              {d.dueAssessments.map((a) => (
                <li
                  key={a.id}
                  style={{
                    padding: '0.75rem 1rem',
                    background: '#fff',
                    border: `1px solid ${STUDENT_PORTAL.border}`,
                    borderRadius: 10,
                    marginBottom: 8,
                  }}
                >
                  <Link
                    href={`/dashboard/lms/${a.courseInstanceId}`}
                    style={{ textDecoration: 'none', color: 'inherit' }}
                  >
                    <div style={{ fontWeight: 600 }}>{a.title}</div>
                    <div style={{ fontSize: '0.85rem', color: STUDENT_PORTAL.muted, marginTop: 2 }}>
                      {a.courseCode} · {a.type}
                    </div>
                    <div
                      style={{
                        fontSize: '0.82rem',
                        color: STUDENT_PORTAL.teal,
                        marginTop: 4,
                        fontWeight: 600,
                      }}
                    >
                      {formatDueDate(a.dueDate)}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section style={{ marginTop: '2rem' }}>
        <h2 style={{ fontSize: '1.1rem', color: STUDENT_PORTAL.text }}>Announcements</h2>
        {d.announcements.length === 0 ? (
          <p style={{ color: STUDENT_PORTAL.muted }}>No recent notifications.</p>
        ) : (
          <ul style={{ padding: 0, listStyle: 'none', margin: '0.75rem 0 0' }}>
            {d.announcements.map((n) => (
              <li
                key={n.id}
                style={{
                  padding: '0.85rem 1rem',
                  background: '#fff',
                  border: `1px solid ${STUDENT_PORTAL.border}`,
                  borderRadius: 10,
                  marginBottom: 8,
                }}
              >
                <div style={{ fontWeight: 600 }}>{n.title}</div>
                <div style={{ color: STUDENT_PORTAL.muted, fontSize: '0.9rem', marginTop: 4 }}>
                  {n.body}
                </div>
              </li>
            ))}
          </ul>
        )}
        <Link
          href="/dashboard/notifications"
          style={{ color: STUDENT_PORTAL.teal, fontWeight: 600 }}
        >
          View all notifications →
        </Link>
      </section>
    </div>
  );
}
