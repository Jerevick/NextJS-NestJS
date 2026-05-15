import Link from 'next/link';
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
        <div style={{ overflowX: 'auto', marginTop: '1rem' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '1px solid #1e293b', color: '#94a3b8' }}>
                <th style={{ padding: '0.5rem 0' }}>Institution</th>
                <th style={{ padding: '0.5rem 0' }}>Status</th>
                <th style={{ padding: '0.5rem 0' }}>Invoice</th>
                <th style={{ padding: '0.5rem 0' }}>Amount</th>
                <th style={{ padding: '0.5rem 0' }}>Created</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((d) => (
                <tr key={d.id} style={{ borderBottom: '1px solid #0f172a' }}>
                  <td style={{ padding: '0.45rem 0' }}>
                    <Link href={`/billing/disputes/${d.id}`} style={{ color: '#60a5fa' }}>
                      {d.institution.name}
                    </Link>
                  </td>
                  <td style={{ padding: '0.45rem 0' }}>{d.status}</td>
                  <td style={{ padding: '0.45rem 0', fontFamily: 'ui-monospace, monospace', fontSize: '0.75rem' }}>
                    {d.invoice.id.slice(0, 8)}…
                    {d.invoice.isRetroactive ? (
                      <span style={{ color: '#fbbf24', marginLeft: 6 }}>retro</span>
                    ) : null}
                  </td>
                  <td style={{ padding: '0.45rem 0' }}>{d.invoice.amount}</td>
                  <td style={{ padding: '0.45rem 0', color: '#64748b' }}>
                    {new Date(d.createdAt).toLocaleDateString()}
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
