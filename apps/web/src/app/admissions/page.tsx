import Link from 'next/link';
import { auth } from '@/auth';
import { buildApiHeaders, apiBase } from '@/lib/server-api';
import { hasPermission } from '@/lib/permissions';

const primary = '#1e3a5f';
const muted = '#64748b';

type ApplicationRow = {
  id: string;
  status: string;
  createdAt: string;
  acceptedStudentId: string | null;
  cycle: { id: string; name: string };
  program: { id: string; code: string; name: string };
  applicant: { id: string; email: string; profile?: { firstName?: string; lastName?: string } | null };
};

type ListResponse = { data: ApplicationRow[]; total: number };

const FUNNEL_STAGES = [
  { key: 'PENDING', label: 'Applied' },
  { key: 'UNDER_REVIEW', label: 'Under review' },
  { key: 'WAITLISTED', label: 'Waitlisted' },
  { key: 'ACCEPTED', label: 'Accepted' },
  { key: 'enrolled', label: 'Enrolled' },
] as const;

function applicantName(row: ApplicationRow): string {
  const p = row.applicant.profile;
  if (p?.firstName || p?.lastName) {
    return [p.firstName, p.lastName].filter(Boolean).join(' ').trim();
  }
  return row.applicant.email;
}

export default async function AdmissionsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; cycleId?: string }>;
}) {
  const sp = await searchParams;
  const session = await auth();
  const canRead = hasPermission(session?.user?.permissions, 'admissions.read');
  const canWrite = hasPermission(session?.user?.permissions, 'admissions.write');

  if (!session?.accessToken) {
    return (
      <main style={{ padding: '2rem', fontFamily: '"IBM Plex Sans", system-ui' }}>
        <h1 style={{ color: primary, fontFamily: '"Crimson Pro", Georgia, serif' }}>Admissions</h1>
        <p style={{ color: muted }}>Sign in to view applications.</p>
        <Link href="/login" style={{ color: primary }}>
          Sign in
        </Link>
      </main>
    );
  }

  if (!canRead) {
    return (
      <main style={{ padding: '2rem', fontFamily: '"IBM Plex Sans", system-ui' }}>
        <h1 style={{ color: primary, fontFamily: '"Crimson Pro", Georgia, serif' }}>Admissions</h1>
        <p style={{ color: muted }}>You need admissions.read permission.</p>
        <Link href="/dashboard" style={{ color: primary }}>
          Dashboard
        </Link>
      </main>
    );
  }

  const qs = new URLSearchParams({ limit: '200' });
  if (sp.status?.trim()) {
    qs.set('status', sp.status.trim());
  }
  if (sp.cycleId?.trim()) {
    qs.set('cycleId', sp.cycleId.trim());
  }

  const res = await fetch(`${apiBase}/admissions/applications?${qs.toString()}`, {
    headers: buildApiHeaders(session),
    cache: 'no-store',
  });

  const cyclesRes = await fetch(`${apiBase}/admissions/cycles?limit=50`, {
    headers: buildApiHeaders(session),
    cache: 'no-store',
  });

  let applications: ApplicationRow[] = [];
  let total = 0;
  if (res.ok) {
    const json = (await res.json()) as ListResponse;
    applications = json.data ?? [];
    total = json.total ?? applications.length;
  }

  const cycles = cyclesRes.ok
    ? ((await cyclesRes.json()) as { data?: { id: string; name: string }[] }).data ?? []
    : [];

  let allForFunnel = applications;
  if (!sp.status && !sp.cycleId && res.ok) {
    const funnelRes = await fetch(`${apiBase}/admissions/applications?limit=500`, {
      headers: buildApiHeaders(session),
      cache: 'no-store',
    });
    if (funnelRes.ok) {
      const funnelJson = (await funnelRes.json()) as ListResponse;
      allForFunnel = funnelJson.data ?? [];
    }
  }

  const funnelCounts: Record<string, number> = {
    PENDING: 0,
    UNDER_REVIEW: 0,
    WAITLISTED: 0,
    ACCEPTED: 0,
    enrolled: 0,
  };
  for (const a of allForFunnel) {
    if (a.acceptedStudentId) {
      funnelCounts.enrolled += 1;
    }
    if (a.status in funnelCounts && a.status !== 'enrolled') {
      funnelCounts[a.status] += 1;
    }
  }

  return (
    <main
      style={{
        padding: '2rem 1.5rem',
        fontFamily: '"IBM Plex Sans", system-ui',
        maxWidth: 1100,
        margin: '0 auto',
      }}
    >
      <nav style={{ marginBottom: '1rem', display: 'flex', gap: '1rem' }}>
        <Link href="/dashboard" style={{ color: muted }}>
          Dashboard
        </Link>
        <Link href="/students" style={{ color: primary }}>
          Students
        </Link>
      </nav>

      <h1 style={{ margin: 0, fontFamily: '"Crimson Pro", Georgia, serif', color: primary }}>Admissions</h1>
      <p style={{ color: muted, fontSize: '0.9rem' }}>
        {total} application{total === 1 ? '' : 's'}
        {canWrite ? ' · You can update status on each application.' : ''}
      </p>

      <section
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
          gap: '0.75rem',
          margin: '1.5rem 0',
        }}
      >
        {FUNNEL_STAGES.map((stage) => (
          <div
            key={stage.key}
            style={{
              border: '1px solid #e2e8f0',
              borderRadius: 8,
              padding: '0.75rem',
              background: '#f8fafc',
            }}
          >
            <div style={{ fontSize: '0.75rem', color: muted }}>{stage.label}</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, fontFamily: 'ui-monospace, monospace' }}>
              {funnelCounts[stage.key] ?? 0}
            </div>
          </div>
        ))}
      </section>

      <form
        method="get"
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '0.75rem',
          marginBottom: '1.25rem',
          alignItems: 'end',
        }}
      >
        <label style={{ display: 'grid', gap: 4, fontSize: '0.85rem' }}>
          Status
          <select name="status" defaultValue={sp.status ?? ''} style={{ padding: '0.4rem' }}>
            <option value="">All</option>
            {['PENDING', 'UNDER_REVIEW', 'WAITLISTED', 'ACCEPTED', 'REJECTED', 'WITHDRAWN'].map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label style={{ display: 'grid', gap: 4, fontSize: '0.85rem' }}>
          Cycle
          <select name="cycleId" defaultValue={sp.cycleId ?? ''} style={{ padding: '0.4rem' }}>
            <option value="">All cycles</option>
            {cycles.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" style={{ padding: '0.45rem 0.85rem', fontWeight: 600 }}>
          Filter
        </button>
      </form>

      {!res.ok ? (
        <p style={{ color: '#b91c1c' }}>Could not load applications (HTTP {res.status}).</p>
      ) : applications.length === 0 ? (
        <p style={{ color: muted }}>No applications match this filter.</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '2px solid #e2e8f0', color: muted }}>
                <th style={{ padding: '0.5rem 0' }}>Applicant</th>
                <th style={{ padding: '0.5rem 0' }}>Program</th>
                <th style={{ padding: '0.5rem 0' }}>Cycle</th>
                <th style={{ padding: '0.5rem 0' }}>Status</th>
                <th style={{ padding: '0.5rem 0' }}>Submitted</th>
              </tr>
            </thead>
            <tbody>
              {applications.map((a) => (
                <tr key={a.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '0.5rem 0' }}>
                    <Link href={`/admissions/${a.id}`} style={{ color: primary, fontWeight: 600 }}>
                      {applicantName(a)}
                    </Link>
                  </td>
                  <td style={{ padding: '0.5rem 0' }}>
                    {a.program.code} — {a.program.name}
                  </td>
                  <td style={{ padding: '0.5rem 0' }}>{a.cycle.name}</td>
                  <td style={{ padding: '0.5rem 0' }}>
                    <span
                      style={{
                        background: a.status === 'ACCEPTED' ? '#dcfce7' : '#f1f5f9',
                        padding: '0.15rem 0.5rem',
                        borderRadius: 4,
                        fontSize: '0.8rem',
                      }}
                    >
                      {a.status}
                    </span>
                    {a.acceptedStudentId ? (
                      <span style={{ marginLeft: 6, color: '#15803d', fontSize: '0.75rem' }}>enrolled</span>
                    ) : null}
                  </td>
                  <td style={{ padding: '0.5rem 0', color: muted }}>
                    {new Date(a.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
