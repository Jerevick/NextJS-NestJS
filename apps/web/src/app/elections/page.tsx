import Link from 'next/link';
import { auth } from '@/auth';
import { ElectionsHub } from '@/components/elections/elections-hub';
import { appendOptionalEntityHeader } from '@/lib/api-headers';
import { hasPermission } from '@/lib/permissions';

const apiBase =
  process.env.AUTH_API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export default async function ElectionsPage() {
  const session = await auth();
  const canRead =
    hasPermission(session?.user?.permissions, 'elections.read') ||
    hasPermission(session?.user?.permissions, 'elections.manage');
  const canManage = hasPermission(session?.user?.permissions, 'elections.manage');

  if (!session?.accessToken) {
    return (
      <main style={{ padding: '2rem' }}>
        <p style={{ color: '#64748b' }}>Sign in to access elections.</p>
      </main>
    );
  }

  if (!canRead) {
    return (
      <main style={{ padding: '2rem', maxWidth: 720 }}>
        <h1 style={{ color: '#0f1729' }}>Elections</h1>
        <p style={{ color: '#64748b' }}>You need elections.read or elections.manage permission.</p>
      </main>
    );
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${session.accessToken}`,
    'X-Institution-ID': session.user.institutionId,
  };
  appendOptionalEntityHeader(headers, session.user);

  let elections: Array<{
    id: string;
    title: string;
    status: string;
    votingOpenDate: string;
    votingCloseDate: string;
    positions: Array<{ title: string }>;
  }> = [];

  const res = await fetch(`${apiBase}/elections`, { headers, cache: 'no-store' });
  if (res.ok) {
    const body = (await res.json()) as { data?: typeof elections };
    elections = (body.data ?? []).map((e) => ({
      ...e,
      positions: Array.isArray(e.positions) ? e.positions : [],
    }));
  }

  return (
    <main style={{ padding: '2rem', maxWidth: 960, margin: '0 auto' }}>
      <p style={{ margin: '0 0 0.5rem' }}>
        <Link href="/dashboard" style={{ color: '#2563eb', fontSize: '0.9rem' }}>
          ← Dashboard
        </Link>
      </p>
      <h1 style={{ color: '#0f1729', margin: '0 0 0.25rem' }}>Elections</h1>
      <p style={{ color: '#64748b', margin: '0 0 1.5rem' }}>
        Anonymous verified voting with blind signatures and publishable results.
      </p>
      <ElectionsHub elections={elections} canManage={canManage} />
    </main>
  );
}
