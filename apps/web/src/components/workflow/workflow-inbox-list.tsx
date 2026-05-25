import Link from 'next/link';

export type WorkflowInboxRow = {
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
  if (hours > 24) return '#15803d';
  if (hours > 6) return '#b45309';
  return '#b91c1c';
}

export function WorkflowInboxList({ rows }: { rows: WorkflowInboxRow[] }) {
  if (!rows.length) {
    return <p style={{ color: '#64748b' }}>No pending workflow actions.</p>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '1.25rem' }}>
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
            style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}
          >
            <div>
              <div style={{ fontWeight: 700 }}>{r.definition.name}</div>
              <div style={{ fontSize: '0.85rem', color: '#64748b' }}>
                {r.entity.name} � {r.currentStepName ?? r.status}
              </div>
            </div>
            <div style={{ fontSize: '0.85rem', color: slaColor(r.dueAt), fontWeight: 600 }}>
              Due {new Date(r.dueAt).toLocaleString()}
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}
