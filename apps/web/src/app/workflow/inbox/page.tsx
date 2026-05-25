import Link from 'next/link';
import { auth } from '@/auth';
import { appendOptionalEntityHeader } from '@/lib/api-headers';

const apiBase = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

type InboxRow = {
  id: string;
  definitionCode: string;
  currentStepName: string | null;
  status: string;
  dueAt: string;
  entity: { code: string; name: string };
  definition: { name: string };
};

function slaColor(dueAt: string): string {
  const hours = (new Date(dueAt).getTime() - Date.now()) / (1000 * 60 * 60);
  if (hours > 24) {
    return '#15803d';
  }
  if (hours > 6) {
    return '#b45309';
  }
  return '#b91c1c';
}

export default async function WorkflowInboxPage() {
  const session = await auth();
  if (!session?.accessToken || !session.user?.institutionId) {
    return (
      <main style={{ padding: '2rem' }}>
        <Link href="/login">Sign in</Link>
      </main>
    );
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${session.accessToken}`,
    'X-Institution-ID': session.user.institutionId,
  };
  appendOptionalEntityHeader(headers, session.user);

  const res = await fetch(`${apiBase}/workflow/inbox`, { headers, cache: 'no-store' });
  const rows: InboxRow[] = res.ok ? ((await res.json()) as { data: InboxRow[] }).data : [];

  return (
    <main style={{ padding: '2rem', fontFamily: 'system-ui', maxWidth: 900 }}>
      <p style={{ marginTop: 0 }}>
        <Link href="/dashboard" style={{ color: '#2563eb' }}>
          ← Dashboard
        </Link>
      </p>
      <h1 style={{ marginTop: 0 }}>Workflow inbox</h1>
      <p style={{ color: '#64748b', fontSize: '0.9rem' }}>
        Actions waiting on your position assignment.
      </p>
      <p style={{ fontSize: '0.9rem', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <Link href="/dashboard/workflow/initiated" style={{ color: '#2563eb' }}>
          Requests I started →
        </Link>
        <Link href="/dashboard/elections/inbox" style={{ color: '#2563eb' }}>
          Elections certification
        </Link>
        <Link href="/dashboard/meetings/inbox" style={{ color: '#2563eb' }}>
          Meeting minutes filing
        </Link>
      </p>

      <div
        style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '1.25rem' }}
      >
        {rows.map((r) => (
          <Link
            key={r.id}
            href={`/dashboard/workflow/${r.id}`}
            style={{
              textDecoration: 'none',
              color: 'inherit',
              border: '1px solid #e2e8f0',
              borderRadius: 12,
              padding: '1rem',
              display: 'block',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: 12,
                flexWrap: 'wrap',
              }}
            >
              <div>
                <div style={{ fontWeight: 700 }}>{r.definition.name}</div>
                <div style={{ fontSize: '0.85rem', color: '#64748b', marginTop: 4 }}>
                  {r.entity.name} ({r.entity.code}) · {r.currentStepName ?? '—'}
                </div>
              </div>
              <div style={{ textAlign: 'right', fontSize: '0.85rem' }}>
                <div style={{ color: slaColor(r.dueAt), fontWeight: 600 }}>
                  Due {new Date(r.dueAt).toLocaleString()}
                </div>
                <div style={{ color: '#94a3b8' }}>{r.status}</div>
              </div>
            </div>
          </Link>
        ))}
        {rows.length === 0 ? (
          <p style={{ color: '#64748b' }}>No pending workflow actions for your account.</p>
        ) : null}
      </div>
    </main>
  );
}
