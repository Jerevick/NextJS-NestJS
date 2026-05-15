import Link from 'next/link';
import { auth } from '@/auth';
import { appendOptionalEntityHeader } from '@/lib/api-headers';
import { hasPermission } from '@/lib/permissions';

const apiBase = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

type PositionRow = {
  id: string;
  code: string;
  title: string;
  level: number;
  scope: string;
  isVacant: boolean;
  orgUnit: { code: string; name: string; type: string };
  currentHolder: { name: string | null; email: string; startDate: string } | null;
};

export default async function PositionsPage({
  searchParams,
}: {
  searchParams: Promise<{ entityId?: string; vacant?: string }>;
}) {
  const session = await auth();
  const { entityId: entityIdParam, vacant } = await searchParams;

  if (!session?.accessToken || !session.user?.institutionId) {
    return (
      <main style={{ padding: '2rem' }}>
        <Link href="/login">Sign in</Link>
      </main>
    );
  }

  const canView =
    hasPermission(session.user.permissions, 'org.read') ||
    hasPermission(session.user.permissions, 'institutions.write') ||
    session.user.permissions?.includes('*');

  if (!canView) {
    return (
      <main style={{ padding: '2rem' }}>
        <p>You need org.read to view positions.</p>
      </main>
    );
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${session.accessToken}`,
    'X-Institution-ID': session.user.institutionId,
  };
  appendOptionalEntityHeader(headers, session.user);

  const entitiesRes = await fetch(`${apiBase}/institutions/${session.user.institutionId}/entities`, {
    headers,
    cache: 'no-store',
  });
  const entities =
    entitiesRes.ok
      ? (((await entitiesRes.json()) as { data?: { id: string; code: string; name: string }[] }).data ?? [])
      : [];

  const entityId =
    entityIdParam ?? (session.user.entityScope === 'ENTITY' ? session.user.entityId : entities[0]?.id);

  let rows: PositionRow[] = [];
  if (entityId) {
    const vacantOnly = vacant === '1' || vacant === 'true';
    const path = vacantOnly ? 'positions/vacant' : 'positions';
    const res = await fetch(
      `${apiBase}/${path}?entityId=${encodeURIComponent(entityId)}`,
      { headers, cache: 'no-store' },
    );
    if (res.ok) {
      const body = (await res.json()) as { data?: PositionRow[] };
      rows = body.data ?? [];
    }
  }

  return (
    <main style={{ padding: '2rem', fontFamily: 'system-ui', maxWidth: 1040 }}>
      <p style={{ marginTop: 0 }}>
        <Link href="/settings/org-structure" style={{ color: '#2563eb' }}>
          ← Org structure
        </Link>
      </p>
      <h1 style={{ marginTop: 0 }}>Positions</h1>

      {session.user.entityScope === 'ALL' ? (
        <nav style={{ display: 'flex', flexWrap: 'wrap', gap: 8, margin: '1rem 0' }}>
          {entities.map((e) => (
            <Link
              key={e.id}
              href={`/settings/positions?entityId=${e.id}${vacant ? '&vacant=1' : ''}`}
              style={{
                padding: '0.35rem 0.65rem',
                borderRadius: 8,
                fontSize: '0.85rem',
                textDecoration: 'none',
                background: entityId === e.id ? '#eff6ff' : '#f8fafc',
                border: '1px solid #cbd5e1',
              }}
            >
              {e.code}
            </Link>
          ))}
          <Link
            href={`/settings/positions?entityId=${entityId ?? ''}&vacant=1`}
            style={{
              padding: '0.35rem 0.65rem',
              borderRadius: 8,
              fontSize: '0.85rem',
              textDecoration: 'none',
              border: '1px solid #fbbf24',
              background: vacant ? '#fffbeb' : '#fff',
            }}
          >
            Vacant only
          </Link>
        </nav>
      ) : null}

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #e2e8f0', textAlign: 'left' }}>
              <th style={{ padding: '0.5rem' }}>Title</th>
              <th style={{ padding: '0.5rem' }}>Unit</th>
              <th style={{ padding: '0.5rem' }}>Level</th>
              <th style={{ padding: '0.5rem' }}>Holder</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={{ padding: '0.5rem' }}>
                  {r.title}{' '}
                  <span style={{ color: '#94a3b8', fontFamily: 'ui-monospace, monospace' }}>{r.code}</span>
                </td>
                <td style={{ padding: '0.5rem' }}>
                  {r.orgUnit.name} ({r.orgUnit.code})
                </td>
                <td style={{ padding: '0.5rem' }}>L{r.level}</td>
                <td style={{ padding: '0.5rem' }}>
                  {r.isVacant ? (
                    <span style={{ color: '#b45309', fontWeight: 600 }}>VACANT</span>
                  ) : (
                    <>
                      {r.currentHolder?.name ?? r.currentHolder?.email}
                      <span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>
                        {' '}
                        since {r.currentHolder?.startDate.slice(0, 10)}
                      </span>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 ? <p style={{ color: '#64748b' }}>No positions found for this campus.</p> : null}
      </div>
    </main>
  );
}
