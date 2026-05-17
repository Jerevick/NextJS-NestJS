import Link from 'next/link';
import {
  InstitutionsDataGrid,
  type InstitutionGridRow,
} from '@/components/data-grids/institutions-data-grid';
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
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
        }}
      >
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
      <InstitutionsDataGrid
        rows={rows.map(
          (r): InstitutionGridRow => ({
            id: r.id,
            name: r.name,
            slug: r.slug,
            plan: r.plan ?? '—',
            status: r.status ?? '—',
            healthScore: String(r.healthScore ?? '—'),
            students: String(r.currentStudentCount ?? r.studentRecords ?? '—'),
          }),
        )}
      />
    </main>
  );
}
