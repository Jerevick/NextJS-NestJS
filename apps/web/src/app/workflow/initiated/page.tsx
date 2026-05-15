import Link from 'next/link';
import { auth } from '@/auth';
import { appendOptionalEntityHeader } from '@/lib/api-headers';

const apiBase = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

type Row = {
  id: string;
  definitionCode: string;
  status: string;
  currentStep: number;
  initiatedAt: string;
  entity: { code: string; name: string };
  definition: { name: string };
};

export default async function WorkflowInitiatedPage() {
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

  const res = await fetch(`${apiBase}/workflow/initiated`, { headers, cache: 'no-store' });
  const rows: Row[] = res.ok ? ((await res.json()) as { data: Row[] }).data : [];

  return (
    <main style={{ padding: '2rem', fontFamily: 'system-ui', maxWidth: 900 }}>
      <p style={{ marginTop: 0 }}>
        <Link href="/workflow/inbox" style={{ color: '#2563eb' }}>
          ← Inbox
        </Link>
      </p>
      <h1 style={{ marginTop: 0 }}>Requests I started</h1>
      <ul style={{ listStyle: 'none', padding: 0 }}>
        {rows.map((r) => (
          <li key={r.id} style={{ marginBottom: '0.75rem' }}>
            <Link href={`/workflow/${r.id}`} style={{ color: '#2563eb', fontWeight: 600 }}>
              {r.definition.name}
            </Link>
            <span style={{ color: '#64748b', fontSize: '0.85rem' }}>
              {' '}
              · {r.entity.code} · step {r.currentStep} · {r.status}
            </span>
          </li>
        ))}
      </ul>
      {rows.length === 0 ? <p style={{ color: '#64748b' }}>No workflows initiated yet.</p> : null}
    </main>
  );
}
