'use client';

import type { OrgChartNode } from '@/components/staff/org-chart-types';
import { StaffOrgChartAvatar } from '@/components/staff/staff-org-chart-avatar';

export function StaffOrgChart({ tree }: { tree: OrgChartNode[] }) {
  if (tree.length === 0) {
    return <p style={{ margin: 0, color: '#64748b', fontSize: '0.9rem' }}>No org units.</p>;
  }
  return (
    <ul style={{ margin: 0, paddingLeft: '1rem', listStyle: 'none' }}>
      {tree.map((node) => (
        <OrgChartNodeView key={node.id} node={node} depth={0} />
      ))}
    </ul>
  );
}

function OrgChartNodeView({ node, depth }: { node: OrgChartNode; depth: number }) {
  const holders = node.positions?.flatMap((p) =>
    p.holders.map((h) => ({ ...h, positionTitle: p.title, positionCode: p.code })),
  );

  return (
    <li style={{ marginTop: depth === 0 ? 0 : 8 }}>
      <div
        style={{
          padding: '0.5rem 0.75rem',
          borderRadius: 8,
          border: '1px solid #e2e8f0',
          background: depth === 0 ? '#f8fafc' : '#fff',
        }}
      >
        <strong style={{ fontSize: '0.85rem', color: '#0f1729' }}>{node.name}</strong>
        <span style={{ marginLeft: 8, fontSize: '0.75rem', color: '#94a3b8' }}>{node.code}</span>

        {holders && holders.length > 0 ? (
          <div style={{ marginTop: 8 }}>
            <div style={{ fontSize: '0.72rem', color: '#64748b', marginBottom: 4 }}>
              Position holders
            </div>
            <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
              {holders.map((h) => (
                <li
                  key={`${h.userId}-${h.positionCode}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    marginTop: 4,
                    fontSize: '0.8rem',
                    color: '#334155',
                  }}
                >
                  <StaffOrgChartAvatar name={h.name} photoUrl={h.photoUrl} />
                  <span>
                    {h.name}
                    {h.staffNumber ? ` · ${h.staffNumber}` : ''} · {h.positionTitle}
                    {h.isActing ? (
                      <span style={{ color: '#b45309', marginLeft: 4 }}>(acting)</span>
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {node.staff && node.staff.length > 0 ? (
          <div style={{ marginTop: holders?.length ? 8 : 6 }}>
            {holders?.length ? (
              <div style={{ fontSize: '0.72rem', color: '#64748b', marginBottom: 4 }}>Staff</div>
            ) : null}
            <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
              {node.staff.map((s) => (
                <li
                  key={s.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    marginTop: 4,
                    fontSize: '0.8rem',
                    color: '#334155',
                  }}
                >
                  <StaffOrgChartAvatar name={s.name} photoUrl={s.photoUrl} />
                  <span>
                    {s.name} · {s.staffNumber} · {s.position.title}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
      {node.children && node.children.length > 0 ? (
        <ul style={{ margin: '0.35rem 0 0', paddingLeft: '1rem', listStyle: 'none' }}>
          {node.children.map((c) => (
            <OrgChartNodeView key={c.id} node={c} depth={depth + 1} />
          ))}
        </ul>
      ) : null}
    </li>
  );
}
