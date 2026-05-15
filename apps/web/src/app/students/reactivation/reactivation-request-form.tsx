'use client';

import { useFormState } from 'react-dom';
import {
  createReactivationRequestAction,
  type ReactivationActionState,
} from './actions';

const initial: ReactivationActionState = {};

const labelStyle = { display: 'block', marginBottom: '0.35rem', fontSize: '0.85rem', color: '#334155' } as const;
const inputStyle = {
  width: '100%',
  maxWidth: 480,
  padding: '0.45rem 0.5rem',
  borderRadius: 6,
  border: '1px solid #cbd5e1',
  marginBottom: '0.75rem',
} as const;
const btnStyle = {
  padding: '0.5rem 1rem',
  borderRadius: 6,
  border: '1px solid #2563eb',
  background: '#2563eb',
  color: '#fff',
  cursor: 'pointer',
  fontSize: '0.9rem',
} as const;

function msg(s: ReactivationActionState) {
  return (
    <>
      {s.error ? (
        <p style={{ color: '#b91c1c', fontSize: '0.85rem', marginTop: '0.5rem' }}>{s.error}</p>
      ) : null}
      {s.ok ? (
        <p style={{ color: '#15803d', fontSize: '0.85rem', marginTop: '0.5rem' }}>{s.ok}</p>
      ) : null}
    </>
  );
}

export function ReactivationRequestForm({ defaultStudentId }: { defaultStudentId?: string }) {
  const [state, action] = useFormState(createReactivationRequestAction, initial);
  return (
    <form action={action} style={{ marginBottom: '2rem', padding: '1rem', border: '1px solid #e2e8f0', borderRadius: 8 }}>
      <h2 style={{ marginTop: 0, fontSize: '1.05rem' }}>New reactivation request</h2>
      <p style={{ fontSize: '0.82rem', color: '#64748b', marginTop: 0 }}>
        Requires <span style={{ fontFamily: 'ui-monospace, monospace' }}>students.write</span>. Approval uses{' '}
        <span style={{ fontFamily: 'ui-monospace, monospace' }}>students.reactivate</span> and sets enrollment to ACTIVE.
      </p>
      <label style={labelStyle}>
        Student id
        <input name="studentId" required defaultValue={defaultStudentId ?? ''} style={{ ...inputStyle, fontFamily: 'ui-monospace, monospace' }} />
      </label>
      <label style={labelStyle}>
        Justification (min 10 characters)
        <textarea name="justification" required minLength={10} rows={4} style={{ ...inputStyle, maxWidth: 560 }} />
      </label>
      <button type="submit" style={btnStyle}>
        Submit request
      </button>
      {msg(state)}
    </form>
  );
}
