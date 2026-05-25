import type { ReactNode } from 'react';
import Link from 'next/link';
import { auth } from '@/auth';
import { appendOptionalEntityHeader } from '@/lib/api-headers';
import { hasPermission } from '@/lib/permissions';

const apiBase = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

type TreeNode = {
  id: string;
  code: string;
  name: string;
  type: string;
  children: TreeNode[];
};

function renderTree(nodes: TreeNode[], depth = 0): ReactNode {
  if (nodes.length === 0) {
    return null;
  }
  return (
    <ul style={{ listStyle: 'none', paddingLeft: depth ? '1.25rem' : 0, margin: '0.35rem 0' }}>
      {nodes.map((n) => (
        <li key={n.id} style={{ fontSize: '0.9rem', marginBottom: 4 }}>
          <span style={{ fontWeight: 600 }}>{n.name}</span>{' '}
          <span style={{ color: '#64748b', fontFamily: 'ui-monospace, monospace' }}>
            ({n.code})
          </span>{' '}
          <span
            style={{
              fontSize: '0.72rem',
              padding: '0.1rem 0.4rem',
              borderRadius: 4,
              background: '#f1f5f9',
              color: '#475569',
            }}
          >
            {n.type}
          </span>
          {renderTree(n.children, depth + 1)}
        </li>
      ))}
    </ul>
  );
}

export default async function OrgStructurePage({
  searchParams,
}: {
  searchParams: Promise<{ entityId?: string }>;
}) {
  const session = await auth();
  const entityIdParam = (await searchParams).entityId;

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
      <main style={{ padding: '2rem', fontFamily: 'system-ui' }}>
        <p>You need org.read or institutions.write to view the org chart.</p>
        <Link href="/dashboard">Dashboard</Link>
      </main>
    );
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${session.accessToken}`,
    'X-Institution-ID': session.user.institutionId,
  };
  appendOptionalEntityHeader(headers, session.user);

  const entitiesRes = await fetch(
    `${apiBase}/institutions/${session.user.institutionId}/entities`,
    {
      headers,
      cache: 'no-store',
    },
  );
  const entitiesJson = entitiesRes.ok
    ? ((await entitiesRes.json()) as { data?: { id: string; name: string; code: string }[] })
    : { data: [] };
  const entities = entitiesJson.data ?? [];

  const activeEntityId =
    entityIdParam ??
    (session.user.entityScope === 'ENTITY' ? session.user.entityId : entities[0]?.id);

  let treePayload: { tree?: TreeNode[] } | null = null;
  let institutionTrees: Array<{
    entity: { id: string; name: string; code: string };
    tree: TreeNode[];
  }> = [];

  if (session.user.entityScope === 'ALL' && !entityIdParam) {
    const instTreeRes = await fetch(`${apiBase}/org-units/institution-tree`, {
      headers,
      cache: 'no-store',
    });
    if (instTreeRes.ok) {
      const body = (await instTreeRes.json()) as { data: typeof institutionTrees };
      institutionTrees = body.data ?? [];
    }
  } else if (activeEntityId) {
    const treeRes = await fetch(
      `${apiBase}/org-units/tree?entityId=${encodeURIComponent(activeEntityId)}`,
      { headers, cache: 'no-store' },
    );
    if (treeRes.ok) {
      treePayload = (await treeRes.json()) as { tree?: TreeNode[] };
    }
  }

  return (
    <main style={{ padding: '2rem', fontFamily: 'system-ui', maxWidth: 900 }}>
      <p style={{ marginTop: 0 }}>
        <Link href="/dashboard" style={{ color: '#2563eb' }}>
          ← Dashboard
        </Link>
      </p>
      {session.user && hasPermission(session.user.permissions, 'grades.write') ? (
        <p style={{ margin: '0', fontSize: '0.9rem' }}>
          <Link
            href="/dashboard/settings/grading-weights"
            style={{ color: '#2563eb', fontWeight: 600 }}
          >
            Grading weights →
          </Link>
        </p>
      ) : null}
      <h1 style={{ marginTop: 0 }}>Org structure</h1>
      <p style={{ color: '#64748b', fontSize: '0.9rem' }}>
        Academic and administrative units within each campus (Phase 3). ReactFlow chart UI can
        replace this tree list later.
      </p>

      {session.user.entityScope === 'ALL' ? (
        <nav style={{ display: 'flex', flexWrap: 'wrap', gap: 8, margin: '1rem 0' }}>
          <Link
            href="/dashboard/settings/org-structure"
            style={{
              padding: '0.35rem 0.65rem',
              borderRadius: 8,
              fontSize: '0.85rem',
              textDecoration: 'none',
              background: !entityIdParam ? '#eff6ff' : '#f8fafc',
              border: '1px solid #cbd5e1',
            }}
          >
            All campuses
          </Link>
          {entities.map((e) => (
            <Link
              key={e.id}
              href={`/dashboard/settings/org-structure?entityId=${e.id}`}
              style={{
                padding: '0.35rem 0.65rem',
                borderRadius: 8,
                fontSize: '0.85rem',
                textDecoration: 'none',
                background: entityIdParam === e.id ? '#eff6ff' : '#f8fafc',
                border: '1px solid #cbd5e1',
              }}
            >
              {e.code}
            </Link>
          ))}
        </nav>
      ) : null}

      {institutionTrees.length > 0
        ? institutionTrees.map((block) => (
            <section
              key={block.entity.id}
              style={{
                marginBottom: '1.5rem',
                padding: '1rem',
                border: '1px solid #e2e8f0',
                borderRadius: 12,
              }}
            >
              <h2 style={{ margin: '0 0 0.75rem', fontSize: '1rem' }}>
                {block.entity.name} <span style={{ color: '#94a3b8' }}>({block.entity.code})</span>
              </h2>
              {block.tree.length > 0 ? (
                renderTree(block.tree)
              ) : (
                <p style={{ color: '#64748b' }}>No org units yet.</p>
              )}
            </section>
          ))
        : null}

      {treePayload ? (
        <section style={{ padding: '1rem', border: '1px solid #e2e8f0', borderRadius: 12 }}>
          {treePayload.tree && treePayload.tree.length > 0 ? (
            renderTree(treePayload.tree)
          ) : (
            <p style={{ color: '#64748b' }}>
              No org units on this campus. New campuses receive a template on provisioning; use{' '}
              <code>POST /org-templates/apply-to-entity</code> for existing campuses.
            </p>
          )}
        </section>
      ) : null}

      <p style={{ marginTop: '1.5rem' }}>
        <Link href="/dashboard/settings/positions" style={{ color: '#2563eb', fontWeight: 600 }}>
          View positions →
        </Link>
      </p>
    </main>
  );
}
