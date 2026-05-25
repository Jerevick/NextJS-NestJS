import Link from 'next/link';
import { auth } from '@/auth';
import { appendOptionalEntityHeader } from '@/lib/api-headers';
import {
  BillingDisputesDataGrid,
  type BillingDisputeGridRow,
} from '@/components/data-grids/misc-data-grids';
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

  return (
    <main style={{ padding: '2rem', fontFamily: 'system-ui', maxWidth: 960 }}>
      <nav style={{ marginBottom: '1rem' }}>
        <Link href="/dashboard/billing" style={{ color: '#2563eb' }}>
          ← Billing
        </Link>
      </nav>
      <h1 style={{ marginTop: 0 }}>Billing disputes</h1>
      <p style={{ color: '#64748b', fontSize: '0.9rem' }}>
        Total: <strong>{payload.total ?? rows.length}</strong>
      </p>
      {!res.ok ? <p style={{ color: '#b91c1c' }}>Could not load disputes ({res.status}).</p> : null}
      <BillingDisputesDataGrid
        rows={rows.map(
          (r): BillingDisputeGridRow => ({
            id: r.id,
            status: r.status,
            invoiceLabel: r.invoice ? `${r.invoice.amount} · ${r.invoice.status}` : '—',
            invoiceId: r.invoice?.id ?? null,
            createdAt: r.createdAt,
            reason: r.reason,
          }),
        )}
      />
    </main>
  );
}
