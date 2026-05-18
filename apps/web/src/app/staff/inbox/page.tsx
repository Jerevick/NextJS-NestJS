import Link from 'next/link';
import { auth } from '@/auth';
import { appendOptionalEntityHeader } from '@/lib/api-headers';
import { hasPermission } from '@/lib/permissions';

const apiBase =
  process.env.AUTH_API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

type InboxRow = {
  id: string;
  definitionCode: string;
  currentStepName: string | null;
  status: string;
  dueAt: string;
  entity: { code: string; name: string };
  definition: { name: string; code: string };
};

export default async function StaffWorkflowInboxPage() {
  const session = await auth();
  if (!session?.accessToken) {
    return (
      <main style={{ padding: '2rem' }}>
        <Link href="/login">Sign in</Link>
      </main>
    );
  }

  const canStaff =
    hasPermission(session.user?.permissions, 'staff.read') ||
    hasPermission(session.user?.permissions, 'staff.write');

  if (!canStaff) {
    return (
      <main style={{ padding: '2rem' }}>
        <p>You need staff.read to view HR workflow actions.</p>
      </main>
    );
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${session.accessToken}`,
    'X-Institution-ID': session.user.institutionId,
  };
  appendOptionalEntityHeader(headers, session.user);

  const res = await fetch(`${apiBase}/staff/workflow-inbox`, { headers, cache: 'no-store' });
  const rows: InboxRow[] = res.ok ? ((await res.json()) as { data: InboxRow[] }).data : [];

  return (
    <main
      style={{ padding: '2rem 2.5rem', maxWidth: 900, background: '#f8fafc', minHeight: '100vh' }}
    >
      <Link href="/staff" style={{ color: '#2563eb', fontSize: '0.9rem' }}>
        ← Staff & HR
      </Link>
      <h1 style={{ margin: '0.75rem 0 0', color: '#0f1729' }}>HR workflow inbox</h1>
      <p style={{ color: '#64748b', fontSize: '0.9rem' }}>
        Leave requests and performance appraisals waiting on your position.
      </p>
      <p style={{ fontSize: '0.9rem' }}>
        <Link href="/workflow/inbox" style={{ color: '#2563eb' }}>
          All workflows →
        </Link>
      </p>
      <div
        style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '1.25rem' }}
      >
        {rows.map((r) => (
          <Link
            key={r.id}
            href={`/workflow/${r.id}`}
            style={{
              textDecoration: 'none',
              color: 'inherit',
              border: '1px solid #e2e8f0',
              borderRadius: 12,
              padding: '1rem',
              display: 'block',
              background: '#fff',
            }}
          >
            <div style={{ fontWeight: 700 }}>{r.definition.name}</div>
            <div style={{ fontSize: '0.85rem', color: '#64748b', marginTop: 4 }}>
              {r.entity.name} · {r.currentStepName ?? '—'} · due{' '}
              {new Date(r.dueAt).toLocaleString()}
            </div>
          </Link>
        ))}
        {rows.length === 0 ? (
          <p style={{ color: '#64748b' }}>No pending HR workflow actions.</p>
        ) : null}
      </div>
    </main>
  );
}
