'use client';

import { useActionState, useEffect, useMemo, useState } from 'react';
import { saveEnrollmentGradeAction } from './actions';

type GradeJson = {
  score?: number;
  letterGrade?: string;
  gradePoints?: number;
  workflowStatus?: string;
  components?: Record<string, unknown>;
};

export type GradeComponentWeightBand = { key: string; label: string; weight: number };

function initCompVals(
  weights: GradeComponentWeightBand[],
  grade: GradeJson | null,
): Record<string, string> {
  const out: Record<string, string> = {};
  const cmRaw = grade?.components;
  const cm =
    cmRaw && typeof cmRaw === 'object' && !Array.isArray(cmRaw)
      ? (cmRaw as Record<string, unknown>)
      : {};
  for (const w of weights) {
    const v = cm[w.key];
    out[w.key] = v === undefined || v === null ? '' : String(v);
  }
  return out;
}

function weightedPreview(
  weights: GradeComponentWeightBand[],
  vals: Record<string, string>,
): string | null {
  let sum = 0;
  for (const b of weights) {
    const raw = (vals[b.key] ?? '').trim();
    if (raw === '') return null;
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 0 || n > 100) return null;
    sum += b.weight * n;
  }
  return String(Math.round(sum * 1000) / 1000);
}

export function GradeEntryCell({
  enrollmentId,
  sectionId,
  initialGrade,
  componentWeights,
}: {
  enrollmentId: string;
  sectionId: string;
  initialGrade: GradeJson | null;
  componentWeights: GradeComponentWeightBand[];
}) {
  const bound = saveEnrollmentGradeAction.bind(null, enrollmentId, sectionId);
  const [state, action, pending] = useActionState(bound, null);
  const g = initialGrade ?? {};
  const [clientErr, setClientErr] = useState<string | null>(null);
  const [compVals, setCompVals] = useState(() => initCompVals(componentWeights, initialGrade));

  useEffect(() => {
    setCompVals(initCompVals(componentWeights, initialGrade));
  }, [enrollmentId, initialGrade, componentWeights]);

  const preview = useMemo(
    () => weightedPreview(componentWeights, compVals),
    [componentWeights, compVals],
  );

  const weightsMode = componentWeights.length > 0;

  return (
    <form
      action={action}
      style={{
        display: 'flex',
        gap: '0.35rem',
        flexWrap: 'wrap',
        alignItems: 'flex-start',
        padding: '4px 0',
      }}
      onSubmit={(e) => {
        setClientErr(null);
        if (weightsMode) {
          for (const w of componentWeights) {
            if (!compVals[w.key]?.trim()) {
              e.preventDefault();
              setClientErr('Enter each component score (0–100).');
              return;
            }
            const n = Number(compVals[w.key]);
            if (!Number.isFinite(n) || n < 0 || n > 100) {
              e.preventDefault();
              setClientErr('Each component score must be between 0 and 100.');
              return;
            }
          }
        }
      }}
    >
      {weightsMode ? (
        <>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '0.35rem',
              alignItems: 'center',
              maxWidth: 420,
            }}
          >
            {componentWeights.map((w) => (
              <label key={w.key} style={{ display: 'grid', gap: 2, fontSize: '0.72rem' }}>
                <span style={{ color: '#64748b' }}>
                  {w.label} ({Math.round(w.weight * 1000) / 10}%)
                </span>
                <input
                  name={`comp_${w.key}`}
                  type="number"
                  min={0}
                  max={100}
                  step={0.1}
                  value={compVals[w.key] ?? ''}
                  onChange={(ev) =>
                    setCompVals((prev) => ({
                      ...prev,
                      [w.key]: ev.target.value,
                    }))
                  }
                  disabled={pending}
                  style={{ width: 74, padding: '0.3rem', fontSize: '0.8rem' }}
                />
              </label>
            ))}
          </div>
          <div style={{ fontSize: '0.72rem', color: '#475569', width: '100%' }}>
            Weighted course score (computed on save){preview !== null ? `: ${preview}` : ': —'}
            {typeof g.score === 'number' && Number.isFinite(g.score) ? (
              <span style={{ marginLeft: 6, color: '#94a3b8' }}>(stored aggregate: {g.score})</span>
            ) : null}
          </div>
        </>
      ) : (
        <input
          name="score"
          type="number"
          min={0}
          max={100}
          step={0.1}
          defaultValue={g.score !== undefined ? String(g.score) : ''}
          placeholder="Score"
          style={{ width: 72, padding: '0.35rem' }}
        />
      )}
      <select
        name="workflowStatus"
        defaultValue={g.workflowStatus ?? 'DRAFT'}
        style={{ padding: '0.35rem' }}
      >
        <option value="DRAFT">Draft</option>
        <option value="SUBMITTED">Submit</option>
        <option value="APPROVED">Approve</option>
      </select>
      <button
        type="submit"
        disabled={pending}
        style={{ padding: '0.35rem 0.6rem', fontSize: '0.8rem' }}
      >
        {pending ? '…' : 'Save'}
      </button>
      {clientErr ? (
        <span style={{ color: '#b91c1c', fontSize: '0.75rem' }}>{clientErr}</span>
      ) : null}
      {state?.error ? (
        <span style={{ color: '#b91c1c', fontSize: '0.75rem' }}>{state.error}</span>
      ) : null}
      {state?.ok ? <span style={{ color: '#15803d', fontSize: '0.75rem' }}>Saved</span> : null}
    </form>
  );
}
