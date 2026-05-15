'use client';

import { useFormState } from 'react-dom';
import {
  approveReactivationRequestAction,
  rejectReactivationRequestAction,
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
const btnApprove = {
  padding: '0.5rem 1rem',
  borderRadius: 6,
  border: '1px solid #15803d',
  background: '#15803d',
  color: '#fff',
  cursor: 'pointer',
  fontSize: '0.9rem',
} as const;
const btnReject = {
  padding: '0.5rem 1rem',
  borderRadius: 6,
  border: '1px solid #b91c1c',
  background: '#b91c1c',
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

export function ReactivationReviewForms({ requestId, canReview, isPending }: { requestId: string; canReview: boolean; isPending: boolean }) {
  const [aState, aAction] = useFormState(approveReactivationRequestAction, initial);
  const [rState, rAction] = useFormState(rejectReactivationRequestAction, initial);

  if (!canReview || !isPending) {
    return null;
  }

  return (
    <section style={{ marginTop: '1.5rem', padding: '1rem', border: '1px solid #e2e8f0', borderRadius: 8 }}>
      <h2 style={{ marginTop: 0, fontSize: '1.05rem' }}>Review</h2>
      <form action={aAction} style={{ marginBottom: '1rem' }}>
        <input type="hidden" name="requestId" value={requestId} />
        <label style={labelStyle}>
          Review notes (optional)
          <input name="reviewNotes" style={inputStyle} />
        </label>
        <button type="submit" style={btnApprove}>
          Approve (set ACTIVE)
        </button>
        {msg(aState)}
      </form>
      <form action={rAction}>
        <input type="hidden" name="requestId" value={requestId} />
        <label style={labelStyle}>
          Review notes (optional)
          <input name="reviewNotes" style={inputStyle} />
        </label>
        <button type="submit" style={btnReject}>
          Reject
        </button>
        {msg(rState)}
      </form>
    </section>
  );
}
