'use client';

import { useMemo } from 'react';
import { Background, Controls, MiniMap, ReactFlow, type Edge, type Node } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import type { OrgChartNode } from '@/components/staff/org-chart-types';
import { StaffOrgChartAvatar } from '@/components/staff/staff-org-chart-avatar';

function unitNodeLabel(node: OrgChartNode) {
  const holders = node.positions?.flatMap((p) =>
    p.holders.map((h) => ({ ...h, positionTitle: p.title })),
  );
  const people = [
    ...(holders ?? []).map((h) => ({
      key: `h-${h.userId}`,
      name: h.name,
      photoUrl: h.photoUrl,
      line: `${h.staffNumber ?? h.email} · ${h.positionTitle}${h.isActing ? ' (acting)' : ''}`,
    })),
    ...(node.staff ?? []).map((s) => ({
      key: `s-${s.id}`,
      name: s.name,
      photoUrl: s.photoUrl,
      line: `${s.staffNumber} · ${s.position.title}`,
    })),
  ].slice(0, 5);

  return (
    <div style={{ padding: 8, maxWidth: 200 }}>
      <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>{node.name}</div>
      <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>{node.code}</div>
      {people.map((p) => (
        <div
          key={p.key}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontSize: '0.72rem',
            marginTop: 4,
            color: '#334155',
          }}
        >
          <StaffOrgChartAvatar name={p.name} photoUrl={p.photoUrl} size={20} />
          <span>{p.line}</span>
        </div>
      ))}
      {people.length === 0 ? (
        <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: 4 }}>No assigned staff</div>
      ) : null}
    </div>
  );
}

function layoutTree(
  nodes: OrgChartNode[],
  parentId: string | null = null,
  depth = 0,
  xStart = 0,
): { flowNodes: Node[]; flowEdges: Edge[]; nextX: number } {
  const flowNodes: Node[] = [];
  const flowEdges: Edge[] = [];
  let x = xStart;
  const yGap = 130;
  const xGap = 240;

  for (const node of nodes) {
    const nodeId = node.id;
    flowNodes.push({
      id: nodeId,
      position: { x: x * xGap, y: depth * yGap },
      data: { label: unitNodeLabel(node) },
      style: {
        border: '1px solid #cbd5e1',
        borderRadius: 10,
        background: '#fff',
        fontSize: 12,
      },
    });
    if (parentId) {
      flowEdges.push({ id: `${parentId}-${nodeId}`, source: parentId, target: nodeId });
    }
    if (node.children?.length) {
      const childLayout = layoutTree(node.children, nodeId, depth + 1, x);
      flowNodes.push(...childLayout.flowNodes);
      flowEdges.push(...childLayout.flowEdges);
      x = childLayout.nextX;
    } else {
      x += 1;
    }
  }
  return { flowNodes, flowEdges, nextX: x };
}

export function StaffOrgChartFlow({ tree }: { tree: OrgChartNode[] }) {
  const { nodes, edges } = useMemo(() => {
    const { flowNodes, flowEdges } = layoutTree(tree);
    return { nodes: flowNodes, edges: flowEdges };
  }, [tree]);

  if (tree.length === 0) {
    return <p style={{ margin: 0, color: '#64748b', fontSize: '0.9rem' }}>No org units.</p>;
  }

  return (
    <div style={{ height: 420, border: '1px solid #e2e8f0', borderRadius: 12 }}>
      <ReactFlow nodes={nodes} edges={edges} fitView proOptions={{ hideAttribution: true }}>
        <Background />
        <Controls />
        <MiniMap />
      </ReactFlow>
    </div>
  );
}
