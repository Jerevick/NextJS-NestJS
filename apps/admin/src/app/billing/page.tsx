import Link from 'next/link';
import {
  AdminDisputesDataGrid,
  type AdminDisputeGridRow,
} from '@/components/data-grids/institutions-data-grid';
import { getPendingBillingDisputes } from '@/lib/platform-api';

type DisputeRow = {
  id: string;
  status: string;
  reason: string | null;
  createdAt: string;
  institution: { id: string; name: string; slug: string };
  invoice: { id: string; amount: string; status: string; isRetroactive: boolean };
};

export default async function BillingDisputesPage() {
  const res = await getPendingBillingDisputes();
  const rows: DisputeRow[] =
    res.mode === 'live' && Array.isArray(res.data) ? (res.data as DisputeRow[]) : [];

  return (
    <main style={{ padding: '2rem' }}>
      <h1 style={{ fontSize: '1.25rem', marginTop: 0 }}>Billing disputes</h1>
      <p style={{ color: '#94a3b8', fontSize: '0.9rem' }}>
        Source: <strong>{res.mode}</strong>
        {res.mode === 'mock' ? ' — configure ADMIN_API_BEARER for live disputes.' : null}
        {res.mode === 'error' && 'message' in res ? ` · ${String(res.message)}` : null}
      </p>

      {rows.length === 0 ? (
        <p style={{ color: '#64748b', marginTop: '1.5rem' }}>No open disputes.</p>
      ) : (
        <AdminDisputesDataGrid
          rows={rows.map(
            (d): AdminDisputeGridRow => ({
              id: d.id,
              institutionName: d.institution.name,
              status: d.status,
              invoiceLabel: `${d.invoice.id.slice(0, 8)}…${d.invoice.isRetroactive ? ' retro' : ''}`,
              amount: d.invoice.amount,
              createdAt: d.createdAt,
            }),
          )}
        />
      )}
    </main>
  );
}
