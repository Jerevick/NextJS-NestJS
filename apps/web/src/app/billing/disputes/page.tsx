import Link from 'next/link';
import { auth } from '@/auth';
import { appendOptionalEntityHeader } from '@/lib/api-headers';
import { canAccessBillingNav } from '@/lib/permissions';

const apiBase = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

type DisputeRow = {
  id: string;
  status: string;
  reason: string;
  createdAt: string;
  invoice?: { id: string; amount: string; status: string; isRetroactive: boolean };
};

export default async function BillingDisputesPage() {
  const session = await auth();
  if (!session?.accessToken || !session.user?.institutionId) {
    return (
      <main style={{ padding: '2rem', fontFamily: 'system-ui' }}>
        <p>Sign in to view disputes.</p>
        <Link href="/login" style={{ color: '#2563eb' }}>
          Login
        </Link>
      </main>
    );
  }
  if (!canAccessBillingNav(session.user.permissions)) {
    return (
      <main style={{ padding: '2rem', fontFamily: 'system-ui' }}>
        <p>You do not have permission to view billing.</p>
        <Link href="/dashboard" style={{ color: '#2563eb' }}>
          Dashboard
        </Link>
      </main>
    );
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${session.accessToken}`,
    'X-Institution-ID': session.user.institutionId,
  };
  appendOptionalEntityHeader(headers, session.user);

  const res = await fetch(`${apiBase}/billing/disputes?limit=50`, { headers, cache: 'no-store' });
  const payload = res.ok
    ? ((await res.json()) as { data?: DisputeRow[]; total?: number })
    : { data: [], total: 0 };
  const rows = payload.data ?? [];
  const mono = { fontFamily: 'ui-monospace, monospace' } as const;

  return (
    <main style={{ padding: '2rem', fontFamily: 'system-ui', maxWidth: 960 }}>
      <nav style={{ marginBottom: '1rem' }}>
        <Link href="/billing" style={{ color: '#2563eb' }}>
          ← Billing
        </Link>
      </nav>
      <h1 style={{ marginTop: 0 }}>Billing disputes</h1>
      <p style={{ color: '#64748b', fontSize: '0.9rem' }}>
        Total: <strong>{payload.total ?? rows.length}</strong>
      </p>
      {!res.ok ? <p style={{ color: '#b91c1c' }}>Could not load disputes ({res.status}).</p> : null}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>
              <th style={{ padding: '0.5rem' }}>Status</th>
              <th style={{ padding: '0.5rem' }}>Invoice</th>
              <th style={{ padding: '0.5rem' }}>Created</th>
              <th style={{ padding: '0.5rem' }}>Reason</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={{ padding: '0.5rem' }}>{r.status}</td>
                <td style={{ padding: '0.5rem', ...mono }}>
                  {r.invoice ? (
                    <Link href={`/billing/invoice/${encodeURIComponent(r.invoice.id)}`} style={{ color: '#2563eb' }}>
                      {r.invoice.amount} · {r.invoice.status}
                    </Link>
                  ) : (
                    '—'
                  )}
                </td>
                <td style={{ padding: '0.5rem', ...mono }}>{r.createdAt?.slice(0, 19)}</td>
                <td style={{ padding: '0.5rem', maxWidth: 360 }}>
                  <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.reason}</span>
                  <Link href={`/billing/disputes/${encodeURIComponent(r.id)}`} style={{ color: '#2563eb', fontSize: '0.8rem' }}>
                    Detail
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
