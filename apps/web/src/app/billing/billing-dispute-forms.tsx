'use client';

import { useFormState } from 'react-dom';
import {
  initiateBillingDisputeAction,
  resolveBillingDisputeAction,
  type BillingActionState,
} from './actions';

const initial: BillingActionState = {};

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
const msg = (s: BillingActionState) => (
  <>
    {s.error ? (
      <p style={{ color: '#b91c1c', fontSize: '0.85rem', marginTop: '0.5rem' }}>{s.error}</p>
    ) : null}
    {s.ok ? (
      <p style={{ color: '#15803d', fontSize: '0.85rem', marginTop: '0.5rem' }}>{s.ok}</p>
    ) : null}
  </>
);

export function InitiateDisputeForm({
  invoiceId,
  disabled,
}: {
  invoiceId: string;
  disabled?: boolean;
}) {
  const [state, action] = useFormState(initiateBillingDisputeAction, initial);
  return (
    <form action={action} style={{ marginTop: '1rem' }}>
      <input type="hidden" name="invoiceId" value={invoiceId} />
      <h3 style={{ fontSize: '1rem' }}>Open billing dispute</h3>
      <p style={{ fontSize: '0.82rem', color: '#64748b', marginTop: 0 }}>
        Optional: one student id per line or comma-separated. Lines are auto-scored against enrollment status
        (ACTIVE lines are auto-rejected under the status contract).
      </p>
      <label style={labelStyle}>
        Reason (min 5 characters)
        <textarea name="reason" required minLength={5} rows={3} style={{ ...inputStyle, maxWidth: 560 }} />
      </label>
      <label style={labelStyle}>
        Disputed student ids (optional)
        <textarea
          name="disputedStudentIds"
          rows={3}
          placeholder={'cuid…\none per line or comma-separated'}
          style={{ ...inputStyle, maxWidth: 560, fontFamily: 'ui-monospace, monospace' }}
        />
      </label>
      <button type="submit" style={btnStyle} disabled={disabled}>
        Submit dispute
      </button>
      {msg(state)}
    </form>
  );
}

export function ResolveDisputeForms({
  disputeId,
  canResolve,
  alreadyResolved,
}: {
  disputeId: string;
  canResolve: boolean;
  alreadyResolved: boolean;
}) {
  const [acceptState, acceptAction] = useFormState(resolveBillingDisputeAction, initial);
  const [rejectState, rejectAction] = useFormState(resolveBillingDisputeAction, initial);

  if (!canResolve || alreadyResolved) {
    return null;
  }

  return (
    <section style={{ marginTop: '1.5rem', padding: '1rem', border: '1px solid #e2e8f0', borderRadius: 8 }}>
      <h3 style={{ marginTop: 0, fontSize: '1rem' }}>Resolve dispute</h3>
      <p style={{ fontSize: '0.82rem', color: '#64748b' }}>Requires billing.disputes.resolve or platform super admin.</p>
      <form action={acceptAction} style={{ marginBottom: '1rem' }}>
        <input type="hidden" name="disputeId" value={disputeId} />
        <input type="hidden" name="resolution" value="ACCEPT" />
        <label style={labelStyle}>
          Notes (optional)
          <input name="notes" style={inputStyle} />
        </label>
        <button type="submit" style={{ ...btnStyle, background: '#15803d', borderColor: '#15803d' }}>
          Accept (institution position)
        </button>
        {msg(acceptState)}
      </form>
      <form action={rejectAction}>
        <input type="hidden" name="disputeId" value={disputeId} />
        <input type="hidden" name="resolution" value="REJECT" />
        <label style={labelStyle}>
          Notes (optional)
          <input name="notes" style={inputStyle} />
        </label>
        <button type="submit" style={{ ...btnStyle, background: '#b91c1c', borderColor: '#b91c1c' }}>
          Reject dispute
        </button>
        {msg(rejectState)}
      </form>
    </section>
  );
}
