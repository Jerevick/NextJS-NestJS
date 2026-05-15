import Link from 'next/link';
import { notFound } from 'next/navigation';
import { auth } from '@/auth';
import { appendOptionalEntityHeader } from '@/lib/api-headers';
import { canAccessBillingNav, hasPermission } from '@/lib/permissions';
import { ResolveDisputeForms } from '../../billing-dispute-forms';

const apiBase = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

type DisputeDetail = {
  id: string;
  status: string;
  reason: string;
  lines: unknown;
  resolutionNotes: string | null;
  createdAt: string;
  invoice?: { id: string; amount: string; status: string; lockedAt: string | null; isRetroactive: boolean };
};

export default async function BillingDisputeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.accessToken || !session.user?.institutionId) {
    return (
      <main style={{ padding: '2rem', fontFamily: 'system-ui' }}>
        <p>Sign in.</p>
        <Link href="/login">Login</Link>
      </main>
    );
  }
  if (!canAccessBillingNav(session.user.permissions)) {
    return (
      <main style={{ padding: '2rem', fontFamily: 'system-ui' }}>
        <p>No access.</p>
        <Link href="/dashboard">Dashboard</Link>
      </main>
    );
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${session.accessToken}`,
    'X-Institution-ID': session.user.institutionId,
  };
  appendOptionalEntityHeader(headers, session.user);

  const res = await fetch(`${apiBase}/billing/disputes/${encodeURIComponent(id)}`, {
    headers,
    cache: 'no-store',
  });
  if (res.status === 404) {
    notFound();
  }
  if (!res.ok) {
    const body = await res.text();
    return (
      <main style={{ padding: '2rem', fontFamily: 'system-ui' }}>
        <Link href="/billing/disputes">← Disputes</Link>
        <p style={{ color: '#b91c1c' }}>HTTP {res.status}</p>
        <pre style={{ fontSize: 12, overflow: 'auto' }}>{body}</pre>
      </main>
    );
  }

  const d = (await res.json()) as DisputeDetail;
  const mono = { fontFamily: 'ui-monospace, monospace' } as const;
  const canResolve = hasPermission(session.user.permissions, 'billing.disputes.resolve');
  const alreadyResolved = d.status === 'RESOLVED_ACCEPTED' || d.status === 'RESOLVED_REJECTED';

  return (
    <main style={{ padding: '2rem', fontFamily: 'system-ui', maxWidth: 900 }}>
      <nav style={{ marginBottom: '1rem' }}>
        <Link href="/billing/disputes" style={{ color: '#2563eb' }}>
          ← Disputes
        </Link>
      </nav>
      <h1 style={{ marginTop: 0 }}>Dispute</h1>
      <p style={mono}>{d.id}</p>
      <dl
        style={{
          display: 'grid',
          gridTemplateColumns: '160px 1fr',
          gap: '0.5rem 1rem',
          fontSize: '0.92rem',
        }}
      >
        <dt style={{ color: '#64748b' }}>Status</dt>
        <dd style={{ margin: 0, fontWeight: 700 }}>{d.status}</dd>
        <dt style={{ color: '#64748b' }}>Reason</dt>
        <dd style={{ margin: 0 }}>{d.reason}</dd>
        <dt style={{ color: '#64748b' }}>Resolution notes</dt>
        <dd style={{ margin: 0 }}>{d.resolutionNotes ?? '—'}</dd>
        <dt style={{ color: '#64748b' }}>Invoice</dt>
        <dd style={{ margin: 0 }}>
          {d.invoice ? (
            <Link href={`/billing/invoice/${encodeURIComponent(d.invoice.id)}`} style={{ color: '#2563eb' }}>
              {d.invoice.amount} · {d.invoice.status}
            </Link>
          ) : (
            '—'
          )}
        </dd>
      </dl>

      <section style={{ marginTop: '1.5rem' }}>
        <h2 style={{ fontSize: '1.05rem' }}>Lines (JSON)</h2>
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
          {JSON.stringify(d.lines, null, 2)}
        </pre>
      </section>

      <ResolveDisputeForms disputeId={d.id} canResolve={canResolve} alreadyResolved={alreadyResolved} />
    </main>
  );
}
