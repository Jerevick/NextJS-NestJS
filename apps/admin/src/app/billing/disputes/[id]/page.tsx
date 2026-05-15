import Link from 'next/link';
import { notFound } from 'next/navigation';
import { env } from '@/env';
import { getPendingBillingDisputes } from '@/lib/platform-api';
import { ResolveDisputeForm } from './resolve-form';

type DisputeRow = {
  id: string;
  status: string;
  reason: string | null;
  lines: unknown;
  createdAt: string;
  institution: { id: string; name: string; slug: string };
  invoice: { id: string; amount: string; status: string; isRetroactive: boolean };
};

export default async function BillingDisputeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const res = await getPendingBillingDisputes();
  const rows: DisputeRow[] =
    res.mode === 'live' && Array.isArray(res.data) ? (res.data as DisputeRow[]) : [];
  const dispute = rows.find((d) => d.id === id);

  if (res.mode === 'live' && !dispute) {
    notFound();
  }

  return (
    <main style={{ padding: '2rem', maxWidth: 720 }}>
      <p style={{ marginTop: 0 }}>
        <Link href="/billing" style={{ color: '#60a5fa' }}>
          ← Billing disputes
        </Link>
      </p>
      <h1 style={{ fontSize: '1.25rem', marginTop: 0 }}>Dispute review</h1>

      {!dispute ? (
        <p style={{ color: '#fbbf24' }}>
          {res.mode === 'mock'
            ? 'Configure ADMIN_API_BEARER to load dispute details.'
            : 'Dispute not found or already resolved.'}
        </p>
      ) : (
        <>
          <dl
            style={{
              display: 'grid',
              gridTemplateColumns: '140px 1fr',
              gap: '0.5rem 1rem',
              fontSize: '0.9rem',
              marginTop: '1rem',
            }}
          >
            <dt style={{ color: '#64748b' }}>Institution</dt>
            <dd style={{ margin: 0 }}>
              <Link href={`/institutions/${dispute.institution.id}`} style={{ color: '#60a5fa' }}>
                {dispute.institution.name}
              </Link>
            </dd>
            <dt style={{ color: '#64748b' }}>Status</dt>
            <dd style={{ margin: 0 }}>{dispute.status}</dd>
            <dt style={{ color: '#64748b' }}>Invoice</dt>
            <dd style={{ margin: 0, fontFamily: 'ui-monospace, monospace', fontSize: '0.8rem' }}>
              {dispute.invoice.id} · {dispute.invoice.amount} · {dispute.invoice.status}
            </dd>
            <dt style={{ color: '#64748b' }}>Reason</dt>
            <dd style={{ margin: 0 }}>{dispute.reason ?? '—'}</dd>
            <dt style={{ color: '#64748b' }}>Created</dt>
            <dd style={{ margin: 0 }}>{new Date(dispute.createdAt).toLocaleString()}</dd>
          </dl>

          {dispute.lines ? (
            <section style={{ marginTop: '1.5rem' }}>
              <h2 style={{ fontSize: '0.95rem', color: '#94a3b8' }}>Dispute lines</h2>
              <pre
                style={{
                  background: '#020617',
                  padding: '1rem',
                  borderRadius: 8,
                  overflow: 'auto',
                  fontSize: '0.75rem',
                }}
              >
                {JSON.stringify(dispute.lines, null, 2)}
              </pre>
            </section>
          ) : null}

          <ResolveDisputeForm disputeId={id} bearerConfigured={Boolean(env.ADMIN_API_BEARER)} />
        </>
      )}
    </main>
  );
}
