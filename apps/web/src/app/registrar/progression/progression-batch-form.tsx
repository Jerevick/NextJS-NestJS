'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { runProgressionEvaluateBatch, type EvaluateBatchState } from './actions';

const initial: EvaluateBatchState = {};

function SubmitRow() {
  const { pending } = useFormStatus();
  return (
    <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
      <button
        type="submit"
        disabled={pending}
        style={{ padding: '0.6rem 1.1rem', fontWeight: 600, borderRadius: 8 }}
      >
        {pending ? 'Running…' : 'Run evaluation'}
      </button>
      <label
        style={{
          display: 'flex',
          gap: 8,
          alignItems: 'center',
          fontSize: '0.88rem',
          color: '#475569',
        }}
      >
        <input type="checkbox" name="dryRun" defaultChecked />
        Dry run (no writes)
      </label>
      <label
        style={{
          display: 'flex',
          gap: 8,
          alignItems: 'center',
          fontSize: '0.88rem',
          color: '#475569',
        }}
      >
        <input type="checkbox" name="initiateReviewWorkflows" />
        When not dry-run: start review workflows (conditional / repeat advised / max duration)
      </label>
    </div>
  );
}

export function ProgressionBatchForm({
  semesters,
}: {
  semesters: { id: string; name: string; startDate: string }[];
}) {
  const [state, formAction] = useFormState(runProgressionEvaluateBatch, initial);

  return (
    <form action={formAction} style={{ display: 'grid', gap: '1rem', maxWidth: 720 }}>
      <label
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
          fontWeight: 600,
          color: '#0f172a',
        }}
      >
        Semester
        <select
          name="semesterId"
          required
          style={{ padding: '0.5rem 0.6rem', borderRadius: 8, border: '1px solid #cbd5e1' }}
          defaultValue=""
        >
          <option value="" disabled>
            Choose semester…
          </option>
          {semesters.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} ({new Date(s.startDate).toLocaleDateString()})
            </option>
          ))}
        </select>
      </label>
      <SubmitRow />
      {state.error ? (
        <p role="alert" style={{ color: '#b91c1c', margin: 0 }}>
          {state.error}
        </p>
      ) : null}
      {state.result ? (
        <pre
          style={{
            fontSize: 12,
            overflow: 'auto',
            background: '#f1f5f9',
            padding: '1rem',
            borderRadius: 8,
            maxHeight: 420,
          }}
        >
          {JSON.stringify(state.result, null, 2)}
        </pre>
      ) : null}
    </form>
  );
}
