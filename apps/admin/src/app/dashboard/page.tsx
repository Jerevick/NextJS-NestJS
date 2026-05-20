import Link from 'next/link';
import { getPlatformOverview, getRegistrationRequests } from '@/lib/platform-api';

export default async function SuperAdminDashboardPage() {
  const overview = await getPlatformOverview();
  const pendingRequests = await getRegistrationRequests({ status: 'PENDING', limit: 5 });
  const pendingCount =
    pendingRequests.mode === 'live' && Array.isArray(pendingRequests.data)
      ? pendingRequests.data.length
      : 0;
  const mono = { fontFamily: 'ui-monospace, monospace' } as const;

  const kpis =
    overview.mode === 'live'
      ? [
          { label: 'Institutions', value: String(overview.totalInstitutions ?? '—') },
          { label: 'Billable students', value: String(overview.totalBillableStudents ?? '—') },
          { label: 'Est. MRR (USD)', value: String(overview.estimatedMrr ?? '—') },
          { label: 'Open disputes', value: String(overview.openDisputes ?? '—') },
          { label: 'Platform health', value: String(overview.platformHealthScore ?? '—') },
          {
            label: 'Revenue (30d paid)',
            value: String(overview.revenuePaidLast30Days ?? '—'),
          },
        ]
      : [
          { label: 'Institutions', value: overview.mode === 'mock' ? '1' : '—' },
          { label: 'MRR', value: '—' },
          { label: 'Billable students', value: '—' },
          { label: 'System health', value: '—' },
        ];

  const anomalies =
    overview.mode === 'live' && Array.isArray(overview.anomalies)
      ? (overview.anomalies as { institutionId: string; name: string; dropPct: number }[])
      : [];

  return (
    <main style={{ padding: '2rem' }}>
      <h1 style={{ marginTop: 0, fontSize: '1.35rem' }}>Platform overview</h1>
      <p style={{ color: '#94a3b8', fontSize: '0.9rem' }}>
        Data: <strong style={{ color: '#e2e8f0' }}>{overview.mode}</strong>
        {overview.mode === 'mock'
          ? ' — set ADMIN_API_BEARER to a super-admin JWT (permission *).'
          : null}
        {overview.mode === 'error' && 'message' in overview
          ? ` — ${String(overview.message)}`
          : null}
      </p>

      <KpiGrid kpis={kpis} mono={mono} />

      {pendingCount > 0 ? (
        <section
          style={{
            marginTop: '1.5rem',
            padding: '1rem 1.25rem',
            borderRadius: 8,
            border: '1px solid #334155',
            background: '#111827',
          }}
        >
          <p style={{ margin: 0, fontSize: '0.9rem' }}>
            <strong style={{ color: '#fbbf24' }}>{pendingCount}</strong>
            <span style={{ color: '#94a3b8' }}> pending registration request(s). </span>
            <Link href="/registration-requests" style={{ color: '#60a5fa' }}>
              Review queue →
            </Link>
          </p>
        </section>
      ) : null}

      {anomalies.length > 0 ? (
        <section style={{ marginTop: '2rem' }}>
          <h2 style={{ fontSize: '1rem', color: '#fbbf24' }}>
            Headcount anomalies (&gt;10% drop, 7d)
          </h2>
          <ul style={{ padding: 0, listStyle: 'none', margin: '0.75rem 0 0' }}>
            {anomalies.map((a) => (
              <li
                key={a.institutionId}
                style={{
                  padding: '0.6rem 0',
                  borderBottom: '1px solid #1e293b',
                  fontSize: '0.88rem',
                }}
              >
                <Link href={`/institutions/${a.institutionId}`} style={{ color: '#60a5fa' }}>
                  {a.name}
                </Link>
                <span style={{ color: '#f87171', marginLeft: 8, ...mono }}>↓ {a.dropPct}%</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <nav style={{ marginTop: '2rem', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
        <Link href="/institutions" style={{ color: '#2563eb' }}>
          All institutions →
        </Link>
        <Link href="/billing" style={{ color: '#2563eb' }}>
          Billing disputes →
        </Link>
        <Link href="/registration-requests" style={{ color: '#2563eb' }}>
          Registration requests →
        </Link>
        <Link href="/institutions/new" style={{ color: '#2563eb' }}>
          Onboard institution →
        </Link>
      </nav>
    </main>
  );
}

function KpiGrid({
  kpis,
  mono,
}: {
  kpis: { label: string; value: string }[];
  mono: { fontFamily: string };
}) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
        gap: '1rem',
        marginTop: '1.5rem',
      }}
    >
      {kpis.map((k) => (
        <div
          key={k.label}
          style={{
            border: '1px solid #1e293b',
            borderRadius: 8,
            padding: '1rem',
            background: '#111111',
          }}
        >
          <div style={{ color: '#64748b', fontSize: '0.75rem' }}>{k.label}</div>
          <div style={{ fontSize: '1.35rem', color: '#f8fafc', marginTop: 4, ...mono }}>
            {k.value}
          </div>
        </div>
      ))}
    </div>
  );
}
