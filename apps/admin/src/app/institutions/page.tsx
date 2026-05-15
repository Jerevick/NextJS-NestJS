import Link from 'next/link';
import { getMonitoringInstitutions } from '@/lib/platform-api';

type Row = {
  id: string;
  slug: string;
  name: string;
  plan?: string;
  status?: string;
  healthScore?: number;
  currentStudentCount?: number;
  userAccounts?: number;
  studentRecords?: number;
};

export default async function InstitutionsPage() {
  const res = await getMonitoringInstitutions();
  const rows: Row[] = Array.isArray(res.data) ? (res.data as Row[]) : [];
  return (
    <main style={{ padding: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <h1 style={{ fontSize: '1.25rem', marginTop: 0 }}>Institutions</h1>
        <Link
          href="/institutions/new"
          style={{
            padding: '0.45rem 0.85rem',
            borderRadius: 6,
            background: '#2563eb',
            color: '#fff',
            textDecoration: 'none',
            fontSize: '0.85rem',
            fontWeight: 600,
          }}
        >
          Onboard institution
        </Link>
      </div>
      <p style={{ color: '#94a3b8', fontSize: '0.9rem' }}>
        Source: <strong>{res.mode}</strong>
        {res.mode === 'error' && 'status' in res ? ` · HTTP ${String(res.status)}` : null}
      </p>
      <div style={{ overflowX: 'auto', marginTop: '1rem' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '1px solid #1e293b', color: '#94a3b8' }}>
              <th style={{ padding: '0.5rem 0' }}>Name</th>
              <th style={{ padding: '0.5rem 0' }}>Slug</th>
              <th style={{ padding: '0.5rem 0' }}>Plan</th>
              <th style={{ padding: '0.5rem 0' }}>Status</th>
              <th style={{ padding: '0.5rem 0' }}>Health</th>
              <th style={{ padding: '0.5rem 0' }}>Students</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} style={{ borderBottom: '1px solid #0f172a' }}>
                <td style={{ padding: '0.45rem 0' }}>
                  <Link href={`/institutions/${r.id}`} style={{ color: '#60a5fa' }}>
                    {r.name}
                  </Link>
                </td>
                <td style={{ padding: '0.45rem 0' }}>{r.slug}</td>
                <td style={{ padding: '0.45rem 0' }}>{r.plan ?? '—'}</td>
                <td style={{ padding: '0.45rem 0' }}>{r.status ?? '—'}</td>
                <td style={{ padding: '0.45rem 0' }}>{r.healthScore ?? '—'}</td>
                <td style={{ padding: '0.45rem 0' }}>{r.currentStudentCount ?? r.studentRecords ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
