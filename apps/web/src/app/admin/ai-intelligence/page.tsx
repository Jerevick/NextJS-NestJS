import Link from 'next/link';
import { auth } from '@/auth';
import { appendOptionalEntityHeader } from '@/lib/api-headers';
import { hasPermission } from '@/lib/permissions';
import { AdminAiPanel } from './admin-ai-panel';

const apiBase =
  process.env.AUTH_API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

type EntityRow = { id: string; name: string; code: string };

export default async function AdminAiIntelligencePage() {
  const session = await auth();
  if (!session?.accessToken || !session.user?.institutionId) {
    return (
      <main style={{ padding: '2rem', fontFamily: 'system-ui' }}>
        <h1>Administrative AI</h1>
        <Link href="/login">Sign in</Link>
      </main>
    );
  }

  const canView =
    hasPermission(session.user.permissions, 'institutions.read') ||
    hasPermission(session.user.permissions, 'institutions.write') ||
    hasPermission(session.user.permissions, 'billing.read');

  if (!canView) {
    return (
      <main style={{ padding: '2rem', fontFamily: 'system-ui', maxWidth: 720 }}>
        <Link href="/admin">← Admin</Link>
        <h1>Administrative AI</h1>
        <p style={{ color: '#b91c1c' }}>You need institutions.read or billing.read access.</p>
      </main>
    );
  }

  const h: Record<string, string> = {
    Authorization: `Bearer ${session.accessToken}`,
    'X-Institution-ID': session.user.institutionId,
  };
  appendOptionalEntityHeader(h, session.user);

  let entities: EntityRow[] = [];
  const entRes = await fetch(`${apiBase}/institution-entities`, { headers: h, cache: 'no-store' });
  if (entRes.ok) {
    entities = (await entRes.json()) as EntityRow[];
  }

  return (
    <main
      style={{
        padding: '2rem 1.5rem 3rem',
        fontFamily: 'system-ui',
        maxWidth: 1100,
        margin: '0 auto',
      }}
    >
      <nav style={{ marginBottom: '1rem', display: 'flex', gap: '1rem' }}>
        <Link href="/admin" style={{ color: '#2563eb' }}>
          ← Admin
        </Link>
        <Link href="/dashboard" style={{ color: '#64748b' }}>
          Dashboard
        </Link>
      </nav>
      <h1 style={{ margin: '0 0 0.35rem', fontFamily: 'Georgia, serif' }}>Administrative AI</h1>
      <p style={{ margin: '0 0 1.5rem', color: '#64748b', lineHeight: 1.5, maxWidth: 640 }}>
        Weekly narratives for leadership, billing anomaly detection (7-day / 30-day snapshot drops),
        and dropout risk by entity or institution-wide.
      </p>
      <AdminAiPanel entities={entities} />
    </main>
  );
}
