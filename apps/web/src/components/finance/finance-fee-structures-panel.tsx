'use client';

import { useState, useTransition } from 'react';
import { deleteFeeStructureAction, updateFeeStructureAction } from '@/app/finance/actions';

type FeeRow = {
  id: string;
  name: string;
  academicYearName: string;
  isDefault: boolean;
};

export function FinanceFeeStructuresPanel({
  feeStructures,
  canWrite,
}: {
  feeStructures: FeeRow[];
  canWrite: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  if (feeStructures.length === 0) {
    return null;
  }

  return (
    <div style={{ marginTop: '1rem' }}>
      <h3 style={{ margin: '0 0 0.5rem', fontSize: '0.95rem', color: '#334155' }}>
        Manage structures
      </h3>
      <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'grid', gap: 8 }}>
        {feeStructures.map((f) => (
          <li
            key={f.id}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 8,
              padding: '0.5rem 0.75rem',
              border: '1px solid #e2e8f0',
              borderRadius: 8,
              background: '#fff',
            }}
          >
            <span style={{ fontSize: '0.88rem' }}>
              {f.name} · {f.academicYearName}
              {f.isDefault ? ' · default' : ''}
            </span>
            {canWrite ? (
              <span style={{ display: 'flex', gap: 6 }}>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => {
                    const next = window.prompt('Rename fee structure', f.name);
                    if (!next?.trim() || next.trim() === f.name) return;
                    setMessage(null);
                    startTransition(async () => {
                      const r = await updateFeeStructureAction(f.id, { name: next.trim() });
                      setMessage(r.error ?? 'Updated.');
                    });
                  }}
                  style={{
                    padding: '0.25rem 0.55rem',
                    fontSize: '0.78rem',
                    borderRadius: 6,
                    border: '1px solid #e2e8f0',
                    background: '#fff',
                    color: '#334155',
                    cursor: 'pointer',
                  }}
                >
                  Rename
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => {
                    if (!confirm(`Delete fee structure "${f.name}"?`)) return;
                    setMessage(null);
                    startTransition(async () => {
                      const r = await deleteFeeStructureAction(f.id);
                      setMessage(r.error ?? 'Deleted.');
                    });
                  }}
                  style={{
                    padding: '0.25rem 0.55rem',
                    fontSize: '0.78rem',
                    borderRadius: 6,
                    border: '1px solid #fecaca',
                    background: '#fff',
                    color: '#b91c1c',
                    cursor: 'pointer',
                  }}
                >
                  Delete
                </button>
              </span>
            ) : null}
          </li>
        ))}
      </ul>
      {message ? (
        <p style={{ margin: '0.5rem 0 0', fontSize: '0.85rem', color: '#64748b' }}>{message}</p>
      ) : null}
    </div>
  );
}
