'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState, useTransition } from 'react';

import type { GradingBandInput } from './actions';
import { saveGradingComponentWeights } from './actions';

function sumWeights(rows: GradingBandInput[]): number {
  return rows.reduce((a, r) => a + (Number.isFinite(r.weight) ? r.weight : 0), 0);
}

function cleanRows(rows: GradingBandInput[]): GradingBandInput[] {
  return rows
    .map((r) => ({
      key: r.key.trim(),
      label: r.label.trim(),
      weight: typeof r.weight === 'number' && Number.isFinite(r.weight) ? r.weight : Number.NaN,
    }))
    .filter((r) => r.key.length > 0 && Number.isFinite(r.weight));
}

export function GradingWeightsEditor({ initialBands }: { initialBands: GradingBandInput[] }) {
  const router = useRouter();
  const primary = '#1e3a5f';
  const muted = '#64748b';
  const [rows, setRows] = useState<GradingBandInput[]>(() =>
    initialBands.length
      ? initialBands.map((b) => ({
          key: b.key,
          label: typeof b.label === 'string' && b.label.trim() ? b.label.trim() : b.key,
          weight: typeof b.weight === 'number' && Number.isFinite(b.weight) ? b.weight : 0,
        }))
      : [
          { key: 'coursework', label: 'Coursework', weight: 0.35 },
          { key: 'midterm', label: 'Midterm', weight: 0.3 },
          { key: 'finalExam', label: 'Final exam', weight: 0.35 },
        ],
  );

  const [msg, setMsg] = useState<{ error?: string; ok?: boolean } | null>(null);
  const [pending, startTransition] = useTransition();

  const total = useMemo(() => sumWeights(rows), [rows]);

  function updateRow(idx: number, patch: Partial<GradingBandInput>) {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  }

  function addRow() {
    setRows((prev) => [
      ...prev,
      { key: '', label: '', weight: Math.max(0.001, 1 - sumWeights(prev)) || 0.1 },
    ]);
  }

  function removeRow(idx: number) {
    setRows((prev) => prev.filter((_, i) => i !== idx));
  }

  function persistAndRefresh(rowsToSave: GradingBandInput[]) {
    startTransition(async () => {
      setMsg(null);
      const result = await saveGradingComponentWeights(rowsToSave);
      setMsg(result.error ? { error: result.error } : { ok: true });
      if (!result.error && result.ok) {
        router.refresh();
      }
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    const cleaned = cleanRows(rows);
    const sum = cleaned.reduce((a, r) => a + r.weight, 0);

    if (cleaned.length === 0) {
      setMsg({ error: 'Provide at least one row, or click “Disable weighted grading”.' });
      return;
    }

    const keyRegex = /^[a-zA-Z][a-zA-Z0-9_-]*$/;
    for (const r of cleaned) {
      if (!keyRegex.test(r.key)) {
        setMsg({
          error: `Key "${r.key}" is invalid. Start with a letter; use letters, digits, hyphen, or underscore.`,
        });
        return;
      }
      if (!(r.weight > 0 && r.weight <= 1)) {
        setMsg({ error: `Each weight must be between 0 and 1 (“${r.key}”).` });
        return;
      }
    }
    if (Math.abs(sum - 1) >= 0.021) {
      setMsg({ error: `Weights must sum to 1.0 (100%). Current sum: ${sum.toFixed(4)}.` });
      return;
    }

    const payload = cleaned.map((r) => ({
      key: r.key,
      label: r.label || r.key,
      weight: r.weight,
    }));
    persistAndRefresh(payload);
  }

  const sumOkDisplay = Math.abs(total - 1) < 0.021 || !rows.some((r) => r.key.trim());

  return (
    <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '1rem', maxWidth: 720 }}>
      <p style={{ color: muted, fontSize: '0.88rem', margin: 0 }}>
        Each numeric component collects a 0–100 score in grade entry. Weights combine them into the
        final course score (then letter grades when your default scale defines bands). Keys must
        stay stable—they persist on enrollment grade JSON.
      </p>

      <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: '0.9rem' }}>
        <thead>
          <tr style={{ borderBottom: '2px solid #e2e8f0', textAlign: 'left', color: muted }}>
            <th style={{ padding: '0.4rem 0.5rem' }}>Key</th>
            <th style={{ padding: '0.4rem 0.5rem' }}>Label</th>
            <th style={{ padding: '0.4rem 0.5rem' }}>Weight (0–1)</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => (
            <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
              <td style={{ padding: '0.45rem 0.5rem' }}>
                <input
                  value={row.key}
                  disabled={pending}
                  onChange={(ev) => updateRow(idx, { key: ev.target.value })}
                  placeholder="coursework"
                  style={{ width: '100%', minWidth: 120, padding: '0.35rem' }}
                />
              </td>
              <td style={{ padding: '0.45rem 0.5rem' }}>
                <input
                  value={row.label}
                  disabled={pending}
                  onChange={(ev) => updateRow(idx, { label: ev.target.value })}
                  placeholder="Coursework avg"
                  style={{ width: '100%', padding: '0.35rem' }}
                />
              </td>
              <td style={{ padding: '0.45rem 0.5rem' }}>
                <input
                  type="number"
                  step="0.001"
                  min={0}
                  max={1}
                  value={row.weight}
                  disabled={pending}
                  onChange={(ev) => updateRow(idx, { weight: Number(ev.target.value) })}
                  style={{ width: '100%', padding: '0.35rem' }}
                />
              </td>
              <td style={{ padding: '0.45rem 0.35rem', textAlign: 'right' }}>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => removeRow(idx)}
                  style={{
                    fontSize: '0.78rem',
                    color: '#b91c1c',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                >
                  Remove
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <button
          type="button"
          disabled={pending}
          onClick={() => addRow()}
          style={{ padding: '0.4rem 0.75rem' }}
        >
          Add row
        </button>
        <span style={{ fontSize: '0.88rem', color: sumOkDisplay ? '#15803d' : '#b45309' }}>
          Σ weights = <strong>{total.toFixed(4)}</strong>
          {!sumOkDisplay && rows.some((r) => r.key.trim())
            ? ' (target 1.0000 for non-empty rows)'
            : ''}
        </span>
      </div>

      <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <button
          type="submit"
          disabled={pending}
          style={{
            padding: '0.5rem 1rem',
            fontWeight: 600,
            background: primary,
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            opacity: pending ? 0.7 : 1,
          }}
        >
          {pending ? 'Saving…' : 'Save policy'}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            const ok =
              typeof window !== 'undefined' &&
              window.confirm(
                'Clear weighted components for this institution? Grade entry switches to a single score until you configure weights again.',
              );
            if (!ok) return;
            persistAndRefresh([]);
          }}
          style={{
            padding: '0.45rem 0.75rem',
            color: '#b91c1c',
            border: '1px solid #fecaca',
            borderRadius: 8,
          }}
        >
          Disable weighted grading
        </button>
      </div>

      {msg?.error ? (
        <p style={{ color: '#b91c1c', fontSize: '0.85rem', margin: 0 }}>{msg.error}</p>
      ) : null}
      {msg?.ok ? <p style={{ color: '#15803d', fontSize: '0.85rem', margin: 0 }}>Saved.</p> : null}
    </form>
  );
}
