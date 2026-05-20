import Link from 'next/link';
import { fetchDashboardJson } from '@/lib/dashboard-api';
import type { Session } from 'next-auth';

const STAFF = {
  text: '#0f172a',
  muted: '#64748b',
  border: '#e2e8f0',
  accent: '#2563eb',
};

type StaffPayload = {
  entityScope: string;
  entity: { code: string; name: string; status: string } | null;
  metrics: {
    workflowPending: number | null;
    activeStudents: number | null;
    pendingApplications: number | null;
  };
  workflowPreview: Array<{
    id: string;
    definitionName: string;
    definitionCode: string;
    dueAt: string;
    entityCode: string;
  }>;
  quickLinks: Array<{ href: string; label: string; description: string }>;
};

export async function StaffHomeDashboard({
  session,
}: {
  session: Session & { accessToken: string };
}) {
  const res = await fetchDashboardJson<StaffPayload>('/dashboard/staff', session);

  if (!res.ok) {
    return (
      <main style={{ padding: '2rem' }}>
        <h1>Staff dashboard</h1>
        <p style={{ color: '#b91c1c' }}>Could not load dashboard ({res.status}).</p>
      </main>
    );
  }

  const d = res.data;

  return (
    <main style={{ padding: '2rem 2.5rem', maxWidth: 1100, fontFamily: 'system-ui' }}>
      <h1 style={{ margin: 0, fontSize: '1.75rem', color: STAFF.text }}>Staff workspace</h1>
      <p style={{ color: STAFF.muted, marginTop: '0.35rem' }}>
        {d.entity
          ? `${d.entity.name} (${d.entity.code}) · ${d.entity.status}`
          : `Institution scope: ${d.entityScope}`}
      </p>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          gap: '0.75rem',
          marginTop: '1.25rem',
        }}
      >
        {d.metrics.workflowPending != null ? (
          <MetricCard
            label="Workflow pending"
            value={String(d.metrics.workflowPending)}
            href="/workflow/inbox"
          />
        ) : null}
        {d.metrics.activeStudents != null ? (
          <MetricCard
            label="Active students"
            value={d.metrics.activeStudents.toLocaleString()}
            href="/students"
          />
        ) : null}
        {d.metrics.pendingApplications != null ? (
          <MetricCard
            label="Applications in review"
            value={d.metrics.pendingApplications.toLocaleString()}
            href="/admissions"
          />
        ) : null}
      </div>

      {d.workflowPreview.length > 0 ? (
        <section style={{ marginTop: '1.75rem' }}>
          <h2 style={{ fontSize: '1.05rem', margin: '0 0 0.65rem' }}>Approvals due soon</h2>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {d.workflowPreview.map((w) => (
              <li
                key={w.id}
                style={{
                  padding: '0.75rem 1rem',
                  background: '#fff',
                  border: `1px solid ${STAFF.border}`,
                  borderRadius: 10,
                  marginBottom: 8,
                }}
              >
                <Link href="/workflow/inbox" style={{ textDecoration: 'none', color: 'inherit' }}>
                  <strong>{w.definitionName}</strong>
                  <div style={{ fontSize: '0.85rem', color: STAFF.muted, marginTop: 4 }}>
                    {w.entityCode} · due {new Date(w.dueAt).toLocaleString()}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section style={{ marginTop: '1.75rem' }}>
        <h2 style={{ fontSize: '1.05rem', margin: '0 0 0.75rem' }}>Quick links</h2>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
            gap: '0.75rem',
          }}
        >
          {d.quickLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              style={{
                padding: '0.85rem 1rem',
                background: '#fff',
                border: `1px solid ${STAFF.border}`,
                borderRadius: 10,
                textDecoration: 'none',
                color: STAFF.text,
              }}
            >
              <div style={{ fontWeight: 600, color: STAFF.accent }}>{link.label}</div>
              <div style={{ fontSize: '0.82rem', color: STAFF.muted, marginTop: 4 }}>
                {link.description}
              </div>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}

function MetricCard({ label, value, href }: { label: string; value: string; href: string }) {
  return (
    <Link
      href={href}
      style={{
        padding: '0.85rem 1rem',
        background: '#fff',
        border: '1px solid #e2e8f0',
        borderRadius: 10,
        textDecoration: 'none',
        color: '#0f172a',
        display: 'block',
      }}
    >
      <div style={{ fontSize: '0.72rem', color: '#64748b', textTransform: 'uppercase' }}>
        {label}
      </div>
      <div style={{ fontSize: '1.5rem', fontWeight: 700, marginTop: 4 }}>{value}</div>
    </Link>
  );
}
