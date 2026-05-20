import Link from 'next/link';
import { fetchDashboardJson } from '@/lib/dashboard-api';
import type { Session } from 'next-auth';

const C = {
  text: '#0f172a',
  muted: '#64748b',
  border: '#e2e8f0',
  accent: '#2563eb',
};

type AdminPayload = {
  entityScope: string;
  entity: { code: string; name: string; status: string } | null;
  institutionTotals: {
    billableStudentCount: number;
    inactiveStudentCount: number;
    totalStudentCount: number;
  } | null;
  entityStats: {
    activeStudents: number;
    totalStudents: number;
    staffCount: number;
    enrollmentsCurrentAcademicYear: number;
  } | null;
  campuses: Array<{ entityId: string; code: string; name: string; activeStudents: number }>;
  workflow: {
    pendingCount: number;
    preview: Array<{
      id: string;
      definitionName: string;
      dueAt: string;
      entityCode: string;
    }>;
  };
};

export async function AdminHomeDashboard({
  session,
}: {
  session: Session & { accessToken: string };
}) {
  const res = await fetchDashboardJson<AdminPayload>('/dashboard/admin', session);

  if (!res.ok) {
    return (
      <main style={{ padding: '2rem' }}>
        <h1>Admin dashboard</h1>
        <p style={{ color: '#b91c1c' }}>Could not load dashboard ({res.status}).</p>
      </main>
    );
  }

  const d = res.data;

  return (
    <main style={{ padding: '2rem 2.5rem', maxWidth: 1100, fontFamily: 'system-ui' }}>
      <h1 style={{ margin: 0, fontSize: '1.75rem', color: C.text }}>Institution overview</h1>
      <p style={{ color: C.muted, marginTop: '0.35rem' }}>
        {d.entity
          ? `${d.entity.name} (${d.entity.code})`
          : d.entityScope === 'ALL'
            ? 'All campuses'
            : `Scope: ${d.entityScope}`}
      </p>

      {d.institutionTotals ? (
        <section
          style={{
            marginTop: '1.25rem',
            padding: '1.25rem',
            borderRadius: 12,
            border: `1px solid ${C.border}`,
            background: '#f8fafc',
          }}
        >
          <h2 style={{ margin: 0, fontSize: '1.05rem' }}>Institution-wide headcount</h2>
          <section
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '1.5rem',
              marginTop: '1rem',
            }}
          >
            <Stat
              label="Billable students"
              value={d.institutionTotals.billableStudentCount}
              large
            />
            <Stat label="Inactive" value={d.institutionTotals.inactiveStudentCount} />
            <Stat label="Total students" value={d.institutionTotals.totalStudentCount} />
          </section>
          <p style={{ marginTop: '1rem', fontSize: '0.9rem' }}>
            <Link href="/entities" style={{ color: C.accent, fontWeight: 600 }}>
              Manage campuses →
            </Link>
          </p>
        </section>
      ) : null}

      {d.entityStats ? (
        <section style={{ marginTop: '1.25rem' }}>
          <h2 style={{ fontSize: '1.05rem' }}>Campus snapshot</h2>
          <section
            style={{ display: 'flex', flexWrap: 'wrap', gap: '1.25rem', marginTop: '0.75rem' }}
          >
            <Stat label="Active students" value={d.entityStats.activeStudents} />
            <Stat label="Staff" value={d.entityStats.staffCount} />
            <Stat label="Enrollments (AY)" value={d.entityStats.enrollmentsCurrentAcademicYear} />
          </section>
        </section>
      ) : null}

      {d.campuses.length > 0 ? (
        <section style={{ marginTop: '1.5rem' }}>
          <h2 style={{ fontSize: '1.05rem' }}>Campuses</h2>
          <ul style={{ listStyle: 'none', padding: 0, marginTop: '0.65rem' }}>
            {d.campuses.map((campus) => (
              <li
                key={campus.entityId}
                style={{
                  padding: '0.65rem 0',
                  borderBottom: `1px solid ${C.border}`,
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: 12,
                }}
              >
                <span>
                  <strong>{campus.name}</strong>
                  <span style={{ color: C.muted }}> ({campus.code})</span>
                </span>
                <span style={{ color: C.muted }}>
                  {campus.activeStudents.toLocaleString()} active
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {d.workflow.pendingCount > 0 ? (
        <section style={{ marginTop: '1.5rem' }}>
          <h2 style={{ fontSize: '1.05rem' }}>Workflow inbox ({d.workflow.pendingCount})</h2>
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {d.workflow.preview.map((w) => (
              <li key={w.id} style={{ padding: '0.5rem 0', fontSize: '0.9rem' }}>
                <Link href="/workflow/inbox" style={{ color: C.accent }}>
                  {w.definitionName}
                </Link>
                <span style={{ color: C.muted }}>
                  {' '}
                  · {w.entityCode} · due {new Date(w.dueAt).toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <nav style={{ marginTop: '1.75rem', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
        <Link href="/admin" style={{ color: C.accent, fontWeight: 600 }}>
          Admin tools →
        </Link>
        <Link href="/entities" style={{ color: C.accent }}>
          Campuses
        </Link>
        <Link href="/students" style={{ color: C.accent }}>
          Students
        </Link>
        <Link href="/settings" style={{ color: C.accent }}>
          Settings
        </Link>
        <Link href="/workflow/inbox" style={{ color: C.accent }}>
          Workflow inbox
        </Link>
      </nav>
    </main>
  );
}

function Stat({ label, value, large }: { label: string; value: number; large?: boolean }) {
  return (
    <section>
      <p style={{ margin: 0, fontSize: '0.72rem', color: '#64748b', textTransform: 'uppercase' }}>
        {label}
      </p>
      <p
        style={{
          margin: '0.25rem 0 0',
          fontSize: large ? '2rem' : '1.35rem',
          fontWeight: 700,
          color: '#0f172a',
        }}
      >
        {value.toLocaleString()}
      </p>
    </section>
  );
}
