import Link from 'next/link';
import { notFound } from 'next/navigation';
import { auth } from '@/auth';
import { appendOptionalEntityHeader } from '@/lib/api-headers';
import { canAccessBillingNav, hasPermission } from '@/lib/permissions';
import { InitiateDisputeForm } from '../../billing-dispute-forms';

const apiBase = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

type LineItem = Record<string, unknown>;

type InvoiceDetail = {
  id: string;
  institutionId: string;
  amount: string;
  status: string;
  dueDate: string | null;
  paidAt: string | null;
  lockedAt: string | null;
  isRetroactive: boolean;
  lineItems: LineItem[];
  createdAt: string;
  updatedAt: string;
};

export default async function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.accessToken || !session.user?.institutionId) {
    return (
      <main style={{ padding: '2rem', fontFamily: 'system-ui' }}>
        <p>Sign in to view this invoice.</p>
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
        <Link href="/dashboard">Dashboard</Link>
      </main>
    );
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${session.accessToken}`,
    'X-Institution-ID': session.user.institutionId,
  };
  appendOptionalEntityHeader(headers, session.user);

  const res = await fetch(`${apiBase}/billing/invoices/${encodeURIComponent(id)}`, {
    headers,
    cache: 'no-store',
  });
  if (res.status === 404) {
    notFound();
  }
  if (!res.ok) {
    const body = await res.text();
    return (
      <main style={{ padding: '2rem', fontFamily: 'system-ui', maxWidth: 720 }}>
        <Link href="/dashboard/billing" style={{ color: '#2563eb' }}>
          ← Billing
        </Link>
        <h1 style={{ marginTop: '1rem' }}>Could not load invoice</h1>
        <p style={{ color: '#b91c1c' }}>HTTP {res.status}</p>
        <pre style={{ fontSize: 12, overflow: 'auto', background: '#f8fafc', padding: '1rem' }}>
          {body}
        </pre>
      </main>
    );
  }

  const inv = (await res.json()) as InvoiceDetail;
  const mono = { fontFamily: 'ui-monospace, monospace' } as const;
  const canWrite = hasPermission(session.user.permissions, 'billing.write');
  const disputeable =
    canWrite && (inv.status === 'DRAFT' || inv.status === 'OPEN') && !inv.lockedAt;

  return (
    <main style={{ padding: '2rem', fontFamily: 'system-ui', maxWidth: 900 }}>
      <nav style={{ marginBottom: '1rem' }}>
        <Link href="/dashboard/billing" style={{ color: '#2563eb' }}>
          ← Billing
        </Link>
      </nav>

      {inv.isRetroactive ? (
        <p
          style={{
            padding: '0.65rem 1rem',
            borderRadius: 8,
            background: '#fff7ed',
            border: '1px solid #fdba74',
            color: '#9a3412',
            fontWeight: 600,
            fontSize: '0.9rem',
          }}
        >
          Retroactive billing — backfill-related draft flag set on this invoice.
        </p>
      ) : null}

      <h1 style={{ marginTop: '1rem', fontSize: '1.5rem' }}>Invoice</h1>
      <p style={{ color: '#64748b', fontSize: '0.9rem', ...mono }}>{inv.id}</p>

      <dl
        style={{
          display: 'grid',
          gridTemplateColumns: '140px 1fr',
          gap: '0.5rem 1rem',
          marginTop: '1.25rem',
          fontSize: '0.92rem',
        }}
      >
        <dt style={{ color: '#64748b' }}>Status</dt>
        <dd style={{ margin: 0, fontWeight: 700 }}>{inv.status}</dd>
        <dt style={{ color: '#64748b' }}>Amount</dt>
        <dd style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, ...mono }}>{inv.amount}</dd>
        <dt style={{ color: '#64748b' }}>Due</dt>
        <dd style={{ margin: 0, ...mono }}>{inv.dueDate ?? '—'}</dd>
        <dt style={{ color: '#64748b' }}>Locked at</dt>
        <dd style={{ margin: 0, ...mono }}>{inv.lockedAt ?? '—'}</dd>
        <dt style={{ color: '#64748b' }}>Paid at</dt>
        <dd style={{ margin: 0, ...mono }}>{inv.paidAt ?? '—'}</dd>
      </dl>

      <section style={{ marginTop: '2rem' }}>
        <h2 style={{ fontSize: '1.1rem' }}>Line items</h2>
        <pre
          style={{
            marginTop: '0.5rem',
            padding: '1rem',
            borderRadius: 8,
            background: '#0f172a',
            color: '#e2e8f0',
            fontSize: '0.78rem',
            overflow: 'auto',
            ...mono,
          }}
        >
          {JSON.stringify(inv.lineItems, null, 2)}
        </pre>
      </section>

      {disputeable ? (
        <section
          style={{
            marginTop: '2rem',
            padding: '1rem',
            border: '1px solid #e2e8f0',
            borderRadius: 8,
          }}
        >
          <InitiateDisputeForm invoiceId={inv.id} />
        </section>
      ) : null}
    </main>
  );
}
