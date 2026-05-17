'use client';

import { useState, useTransition } from 'react';
import { deleteFeeStructureAction, updateFeeStructureAction } from '@/app/finance/actions';

export type FeeStructureItem = {
  code: string;
  name: string;
  amount: number;
  mandatory?: boolean;
  billedAt?: string;
};

export type FeeStructureRow = {
  id: string;
  name: string;
  academicYearName: string;
  isDefault: boolean;
  items: FeeStructureItem[];
};

const BILLED_AT_OPTIONS = ['ENROLLMENT', 'PER_COURSE', 'SEMESTER_START', 'MANUAL'] as const;

function emptyItem(): FeeStructureItem {
  return { code: 'FEE', name: 'Fee line', amount: 0, billedAt: 'ENROLLMENT' };
}

export function FinanceFeeStructureEditor({
  feeStructures,
  canWrite,
}: {
  feeStructures: FeeStructureRow[];
  canWrite: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<
    Record<string, { name: string; isDefault: boolean; items: FeeStructureItem[] }>
  >({});

  if (feeStructures.length === 0) {
    return null;
  }

  const draftFor = (f: FeeStructureRow) =>
    drafts[f.id] ?? {
      name: f.name,
      isDefault: f.isDefault,
      items: f.items.length > 0 ? f.items.map((i) => ({ ...i })) : [emptyItem()],
    };

  return (
    <div style={{ marginTop: '1rem' }}>
      <h3 style={{ margin: '0 0 0.5rem', fontSize: '0.95rem', color: '#334155' }}>
        Manage structures
      </h3>
      <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'grid', gap: 10 }}>
        {feeStructures.map((f) => {
          const open = expandedId === f.id;
          const draft = draftFor(f);
          return (
            <li
              key={f.id}
              style={{
                border: '1px solid #e2e8f0',
                borderRadius: 10,
                background: '#fff',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 8,
                  padding: '0.6rem 0.85rem',
                  flexWrap: 'wrap',
                }}
              >
                <button
                  type="button"
                  onClick={() => setExpandedId(open ? null : f.id)}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    textAlign: 'left',
                    cursor: 'pointer',
                    fontSize: '0.88rem',
                    color: '#0f1729',
                    padding: 0,
                  }}
                >
                  <strong>{f.name}</strong> · {f.academicYearName}
                  {f.isDefault ? ' · default' : ''} · {f.items.length} line(s)
                </button>
                {canWrite ? (
                  <span style={{ display: 'flex', gap: 6 }}>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => setExpandedId(open ? null : f.id)}
                      style={{
                        padding: '0.25rem 0.55rem',
                        fontSize: '0.78rem',
                        borderRadius: 6,
                        border: '1px solid #e2e8f0',
                        background: '#fff',
                        cursor: 'pointer',
                      }}
                    >
                      {open ? 'Close' : 'Edit items'}
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
              </div>

              {open && canWrite ? (
                <form
                  style={{
                    padding: '0.75rem 0.85rem 1rem',
                    borderTop: '1px solid #f1f5f9',
                    display: 'grid',
                    gap: 10,
                    background: '#f8fafc',
                  }}
                  onSubmit={(e) => {
                    e.preventDefault();
                    setMessage(null);
                    const items = draft.items
                      .map((i) => ({
                        code: i.code.trim(),
                        name: i.name.trim(),
                        amount: Number(i.amount),
                        billedAt: i.billedAt?.trim() || 'ENROLLMENT',
                        mandatory: i.mandatory === true,
                      }))
                      .filter(
                        (i) => i.code && i.name && Number.isFinite(i.amount) && i.amount >= 0,
                      );
                    if (items.length === 0) {
                      setMessage('Add at least one valid fee line.');
                      return;
                    }
                    startTransition(async () => {
                      const r = await updateFeeStructureAction(f.id, {
                        name: draft.name.trim(),
                        isDefault: draft.isDefault,
                        items,
                      });
                      setMessage(r.error ?? 'Fee structure saved.');
                    });
                  }}
                >
                  <label style={{ display: 'grid', gap: 4, fontSize: '0.85rem' }}>
                    Structure name
                    <input
                      value={draft.name}
                      onChange={(e) =>
                        setDrafts((d) => ({
                          ...d,
                          [f.id]: { ...draft, name: e.target.value },
                        }))
                      }
                      required
                      style={{
                        padding: '0.45rem 0.6rem',
                        borderRadius: 8,
                        border: '1px solid #e2e8f0',
                      }}
                    />
                  </label>
                  <label
                    style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem' }}
                  >
                    <input
                      type="checkbox"
                      checked={draft.isDefault}
                      onChange={(e) =>
                        setDrafts((d) => ({
                          ...d,
                          [f.id]: { ...draft, isDefault: e.target.checked },
                        }))
                      }
                    />
                    Default for matching programmes / year
                  </label>

                  <p style={{ margin: 0, fontSize: '0.82rem', color: '#64748b', fontWeight: 600 }}>
                    Fee lines
                  </p>
                  {draft.items.map((item, idx) => (
                    <div
                      key={`${f.id}-line-${idx}`}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr',
                        gap: 8,
                        padding: 8,
                        border: '1px solid #e2e8f0',
                        borderRadius: 8,
                        background: '#fff',
                      }}
                    >
                      <label style={{ display: 'grid', gap: 4, fontSize: '0.8rem' }}>
                        Code
                        <input
                          value={item.code}
                          onChange={(e) => {
                            const items = [...draft.items];
                            items[idx] = { ...items[idx], code: e.target.value };
                            setDrafts((d) => ({ ...d, [f.id]: { ...draft, items } }));
                          }}
                          style={{
                            padding: '0.35rem 0.5rem',
                            borderRadius: 6,
                            border: '1px solid #e2e8f0',
                          }}
                        />
                      </label>
                      <label style={{ display: 'grid', gap: 4, fontSize: '0.8rem' }}>
                        Amount
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          value={item.amount}
                          onChange={(e) => {
                            const items = [...draft.items];
                            items[idx] = { ...items[idx], amount: Number(e.target.value) };
                            setDrafts((d) => ({ ...d, [f.id]: { ...draft, items } }));
                          }}
                          style={{
                            padding: '0.35rem 0.5rem',
                            borderRadius: 6,
                            border: '1px solid #e2e8f0',
                          }}
                        />
                      </label>
                      <label
                        style={{
                          display: 'grid',
                          gap: 4,
                          fontSize: '0.8rem',
                          gridColumn: '1 / -1',
                        }}
                      >
                        Label
                        <input
                          value={item.name}
                          onChange={(e) => {
                            const items = [...draft.items];
                            items[idx] = { ...items[idx], name: e.target.value };
                            setDrafts((d) => ({ ...d, [f.id]: { ...draft, items } }));
                          }}
                          style={{
                            padding: '0.35rem 0.5rem',
                            borderRadius: 6,
                            border: '1px solid #e2e8f0',
                          }}
                        />
                      </label>
                      <label style={{ display: 'grid', gap: 4, fontSize: '0.8rem' }}>
                        Billed at
                        <select
                          value={item.billedAt ?? 'ENROLLMENT'}
                          onChange={(e) => {
                            const items = [...draft.items];
                            items[idx] = { ...items[idx], billedAt: e.target.value };
                            setDrafts((d) => ({ ...d, [f.id]: { ...draft, items } }));
                          }}
                          style={{
                            padding: '0.35rem 0.5rem',
                            borderRadius: 6,
                            border: '1px solid #e2e8f0',
                          }}
                        >
                          {BILLED_AT_OPTIONS.map((o) => (
                            <option key={o} value={o}>
                              {o}
                            </option>
                          ))}
                        </select>
                      </label>
                      <div style={{ display: 'flex', alignItems: 'end', gap: 8 }}>
                        <label
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                            fontSize: '0.8rem',
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={item.mandatory === true}
                            onChange={(e) => {
                              const items = [...draft.items];
                              items[idx] = { ...items[idx], mandatory: e.target.checked };
                              setDrafts((d) => ({ ...d, [f.id]: { ...draft, items } }));
                            }}
                          />
                          Mandatory
                        </label>
                        {draft.items.length > 1 ? (
                          <button
                            type="button"
                            onClick={() => {
                              const items = draft.items.filter((_, i) => i !== idx);
                              setDrafts((d) => ({ ...d, [f.id]: { ...draft, items } }));
                            }}
                            style={{
                              padding: '0.25rem 0.5rem',
                              fontSize: '0.75rem',
                              border: '1px solid #fecaca',
                              borderRadius: 6,
                              background: '#fff',
                              color: '#b91c1c',
                              cursor: 'pointer',
                            }}
                          >
                            Remove
                          </button>
                        ) : null}
                      </div>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => {
                      setDrafts((d) => ({
                        ...d,
                        [f.id]: { ...draft, items: [...draft.items, emptyItem()] },
                      }));
                    }}
                    style={{
                      padding: '0.35rem 0.65rem',
                      fontSize: '0.8rem',
                      borderRadius: 6,
                      border: '1px dashed #cbd5e1',
                      background: '#fff',
                      cursor: 'pointer',
                      width: 'fit-content',
                    }}
                  >
                    + Add line
                  </button>

                  <button
                    type="submit"
                    disabled={pending}
                    style={{
                      padding: '0.5rem 1rem',
                      borderRadius: 8,
                      border: 'none',
                      background: '#1e3a5f',
                      color: '#fff',
                      fontWeight: 600,
                      cursor: pending ? 'wait' : 'pointer',
                      width: 'fit-content',
                    }}
                  >
                    {pending ? 'Saving…' : 'Save structure'}
                  </button>
                </form>
              ) : null}
            </li>
          );
        })}
      </ul>
      {message ? (
        <p style={{ margin: '0.5rem 0 0', fontSize: '0.85rem', color: '#64748b' }}>{message}</p>
      ) : null}
    </div>
  );
}
