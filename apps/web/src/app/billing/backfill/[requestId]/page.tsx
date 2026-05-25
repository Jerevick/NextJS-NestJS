import Link from 'next/link';
import { notFound } from 'next/navigation';
import { auth } from '@/auth';
import { appendOptionalEntityHeader } from '@/lib/api-headers';
import { hasPermission } from '@/lib/permissions';

const apiBase = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

type BackfillDetail = {
  id: string;
  status: string;
  fromDate: string;
  toDate: string;
  justification: string;
  billingAcknowledged: boolean;
  student?: { studentNumber: string; enrollmentStatus: string };
  entity?: { code: string; name: string };
};

export default async function BillingBackfillDetailPage({
  params,
}: {
  params: Promise<{ requestId: string }>;
}) {
  const { requestId } = await params;
  const session = await auth();
  if (!session?.accessToken || !session.user?.institutionId) {
    return (
      <main style={{ padding: '2rem', fontFamily: 'system-ui' }}>
        <p>Sign in.</p>
        <Link href="/login">Login</Link>
      </main>
    );
  }
  if (!hasPermission(session.user.permissions, 'backfill.read')) {
    return (
      <main style={{ padding: '2rem', fontFamily: 'system-ui' }}>
        <p>You need backfill.read to view this request.</p>
        <Link href="/dashboard">Dashboard</Link>
      </main>
    );
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${session.accessToken}`,
    'X-Institution-ID': session.user.institutionId,
  };
  appendOptionalEntityHeader(headers, session.user);

  const res = await fetch(`${apiBase}/backfill-requests/${encodeURIComponent(requestId)}`, {
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
        <Link href="/dashboard/billing">← Billing</Link>
        <p style={{ color: '#b91c1c' }}>HTTP {res.status}</p>
        <pre style={{ fontSize: 12 }}>{body}</pre>
      </main>
    );
  }

  const r = (await res.json()) as BackfillDetail;
  const mono = { fontFamily: 'ui-monospace, monospace' } as const;

  return (
    <main style={{ padding: '2rem', fontFamily: 'system-ui', maxWidth: 720 }}>
      <nav style={{ marginBottom: '1rem' }}>
        <Link href="/dashboard/billing" style={{ color: '#2563eb' }}>
          ← Billing
        </Link>
      </nav>
      <h1 style={{ marginTop: 0 }}>Backfill request</h1>
      <p style={mono}>{r.id}</p>
      <dl
        style={{
          display: 'grid',
          gridTemplateColumns: '180px 1fr',
          gap: '0.5rem 1rem',
          fontSize: '0.92rem',
        }}
      >
        <dt style={{ color: '#64748b' }}>Status</dt>
        <dd style={{ margin: 0, fontWeight: 700 }}>{r.status}</dd>
        <dt style={{ color: '#64748b' }}>Student</dt>
        <dd style={{ margin: 0 }}>
          {r.student ? (
            <>
              <span style={mono}>{r.student.studentNumber}</span> · {r.student.enrollmentStatus}
            </>
          ) : (
            '—'
          )}
        </dd>
        <dt style={{ color: '#64748b' }}>Campus</dt>
        <dd style={{ margin: 0 }}>{r.entity ? `${r.entity.code} — ${r.entity.name}` : '—'}</dd>
        <dt style={{ color: '#64748b' }}>Window (UTC)</dt>
        <dd style={{ margin: 0, ...mono }}>
          {r.fromDate?.slice(0, 10)} → {r.toDate?.slice(0, 10)}
        </dd>
        <dt style={{ color: '#64748b' }}>Billing acknowledged</dt>
        <dd style={{ margin: 0 }}>{r.billingAcknowledged ? 'yes' : 'no'}</dd>
        <dt style={{ color: '#64748b' }}>Justification</dt>
        <dd style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{r.justification}</dd>
      </dl>
    </main>
  );
}
