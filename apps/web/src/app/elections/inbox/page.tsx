import Link from 'next/link';
import { auth } from '@/auth';
import {
  WorkflowInboxList,
  type WorkflowInboxRow,
} from '@/components/workflow/workflow-inbox-list';
import { appendOptionalEntityHeader } from '@/lib/api-headers';

const apiBase = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export default async function ElectionsInboxPage() {
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

  const res = await fetch(
    `${apiBase}/workflow/inbox?codes=${encodeURIComponent('ELECTION_CERTIFICATION')}`,
    { headers, cache: 'no-store' },
  );
  const rows: WorkflowInboxRow[] = res.ok
    ? ((await res.json()) as { data: WorkflowInboxRow[] }).data
    : [];

  return (
    <main style={{ padding: '2rem', fontFamily: 'system-ui', maxWidth: 900 }}>
      <p style={{ marginTop: 0 }}>
        <Link href="/elections" style={{ color: '#2563eb' }}>
          ← Elections
        </Link>
        {' · '}
        <Link href="/workflow/inbox" style={{ color: '#2563eb' }}>
          All workflows
        </Link>
      </p>
      <h1 style={{ marginTop: 0 }}>Election certification inbox</h1>
      <p style={{ color: '#64748b', fontSize: '0.9rem' }}>
        Dean and registrar steps for certifying election results.
      </p>
      <WorkflowInboxList rows={rows} />
    </main>
  );
}
