'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';

export type AppraisalTrackerRow = {
  id: string;
  status: string;
  type: string;
  staff: { staffNumber: string; positionId?: string };
  workflowInstance?: {
    id: string;
    currentStep: number;
    currentStepName: string | null;
    status: string;
  } | null;
};

const STATUS_META: Record<string, { label: string; bg: string; color: string; order: number }> = {
  DRAFT: { label: 'Draft', bg: '#f1f5f9', color: '#475569', order: 0 },
  SELF_REVIEW: { label: 'Self-review', bg: '#e0f2fe', color: '#0369a1', order: 1 },
  PENDING_REVIEW: { label: 'Immediate head', bg: '#fef3c7', color: '#b45309', order: 2 },
  PENDING_ENDORSEMENT: { label: 'Endorsement', bg: '#ffedd5', color: '#c2410c', order: 3 },
  COMPLETED: { label: 'Completed', bg: '#dcfce7', color: '#15803d', order: 4 },
  REJECTED: { label: 'Rejected', bg: '#fee2e2', color: '#b91c1c', order: 5 },
};

function StatusBadge({ status }: { status: string }) {
  const meta = STATUS_META[status] ?? {
    label: status,
    bg: '#f1f5f9',
    color: '#64748b',
    order: 99,
  };
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '0.15rem 0.45rem',
        borderRadius: 6,
        fontSize: '0.72rem',
        fontWeight: 600,
        background: meta.bg,
        color: meta.color,
      }}
    >
      {meta.label}
    </span>
  );
}

export function StaffAppraisalTracker({ appraisals }: { appraisals: AppraisalTrackerRow[] }) {
  const [filter, setFilter] = useState<string>('all');

  const summary = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const a of appraisals) {
      counts[a.status] = (counts[a.status] ?? 0) + 1;
    }
    return counts;
  }, [appraisals]);

  const filtered = useMemo(() => {
    const list =
      filter === 'all'
        ? appraisals
        : filter === 'active'
          ? appraisals.filter(
              (a) => a.status !== 'COMPLETED' && a.status !== 'REJECTED' && a.status !== 'DRAFT',
            )
          : appraisals.filter((a) => a.status === filter);
    return [...list].sort((a, b) => {
      const oa = STATUS_META[a.status]?.order ?? 99;
      const ob = STATUS_META[b.status]?.order ?? 99;
      return oa - ob || a.staff.staffNumber.localeCompare(b.staff.staffNumber);
    });
  }, [appraisals, filter]);

  if (appraisals.length === 0) {
    return <p style={{ margin: 0, color: '#64748b', fontSize: '0.9rem' }}>No appraisal cycles.</p>;
  }

  return (
    <div>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 8,
          marginBottom: '0.75rem',
        }}
      >
        {Object.entries(STATUS_META).map(([key, meta]) => {
          const n = summary[key] ?? 0;
          if (n === 0 && key !== 'PENDING_REVIEW' && key !== 'COMPLETED') return null;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(filter === key ? 'all' : key)}
              style={{
                padding: '0.35rem 0.6rem',
                borderRadius: 8,
                border: filter === key ? `2px solid ${meta.color}` : '1px solid #e2e8f0',
                background: meta.bg,
                color: meta.color,
                fontSize: '0.75rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {meta.label} ({n})
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => setFilter('active')}
          style={{
            padding: '0.35rem 0.6rem',
            borderRadius: 8,
            border: filter === 'active' ? '2px solid #2563eb' : '1px solid #e2e8f0',
            background: '#eff6ff',
            color: '#2563eb',
            fontSize: '0.75rem',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          In progress
        </button>
      </div>

      <select
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        style={{
          marginBottom: '0.65rem',
          padding: '0.35rem 0.5rem',
          borderRadius: 6,
          border: '1px solid #e2e8f0',
          fontSize: '0.8rem',
        }}
      >
        <option value="all">All statuses</option>
        <option value="active">In progress only</option>
        {Object.keys(STATUS_META).map((k) => (
          <option key={k} value={k}>
            {STATUS_META[k].label}
          </option>
        ))}
      </select>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', fontSize: '0.85rem', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #e2e8f0', color: '#64748b', textAlign: 'left' }}>
              <th style={{ padding: '0.4rem' }}>Staff</th>
              <th style={{ padding: '0.4rem' }}>Type</th>
              <th style={{ padding: '0.4rem' }}>Status</th>
              <th style={{ padding: '0.4rem' }}>Workflow step</th>
              <th style={{ padding: '0.4rem' }} />
            </tr>
          </thead>
          <tbody>
            {filtered.map((a) => (
              <tr key={a.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={{ padding: '0.4rem', fontFamily: 'monospace' }}>
                  {a.staff.staffNumber}
                </td>
                <td style={{ padding: '0.4rem' }}>{a.type.replace(/_/g, ' ')}</td>
                <td style={{ padding: '0.4rem' }}>
                  <StatusBadge status={a.status} />
                </td>
                <td style={{ padding: '0.4rem', color: '#64748b' }}>
                  {a.workflowInstance?.currentStepName ?? '—'}
                </td>
                <td style={{ padding: '0.4rem' }}>
                  {a.workflowInstance?.id ? (
                    <Link
                      href={`/workflow/${a.workflowInstance.id}`}
                      style={{ color: '#2563eb', fontSize: '0.8rem' }}
                    >
                      Open
                    </Link>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p style={{ margin: '0.5rem 0 0', fontSize: '0.75rem', color: '#94a3b8' }}>
        Showing {filtered.length} of {appraisals.length} appraisals
      </p>
    </div>
  );
}
