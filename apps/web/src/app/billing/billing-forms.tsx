'use client';

import { useFormState } from 'react-dom';
import {
  computeMonthlyRollupAction,
  finalizeInvoiceAction,
  generateDraftInvoiceAction,
  lockSnapshotsAction,
  runDailySnapshotsAction,
  unlockSnapshotsAction,
  type BillingActionState,
} from './actions';

const initial: BillingActionState = {};

const labelStyle = { display: 'block', marginBottom: '0.35rem', fontSize: '0.85rem', color: '#334155' } as const;
const inputStyle = {
  width: '100%',
  maxWidth: 360,
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

export function RunSnapshotsForm() {
  const [state, action] = useFormState(runDailySnapshotsAction, initial);
  return (
    <form action={action} style={{ marginBottom: '1.25rem' }}>
      <button type="submit" style={btnStyle}>
        Run today’s daily snapshots
      </button>
      {msg(state)}
    </form>
  );
}

export function ComputeMonthlyForm({ year, month }: { year: number; month: number }) {
  const [state, action] = useFormState(computeMonthlyRollupAction, initial);
  return (
    <form action={action} style={{ marginBottom: '1.25rem' }}>
      <input type="hidden" name="year" value={year} />
      <input type="hidden" name="month" value={month} />
      <button type="submit" style={btnStyle}>
        Compute monthly rollup ({year}-{String(month).padStart(2, '0')})
      </button>
      {msg(state)}
    </form>
  );
}

export function GenerateDraftForm({ year, month }: { year: number; month: number }) {
  const [state, action] = useFormState(generateDraftInvoiceAction, initial);
  return (
    <form action={action} style={{ marginBottom: '1.25rem' }}>
      <input type="hidden" name="year" value={year} />
      <input type="hidden" name="month" value={month} />
      <label style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.75rem' }}>
        <input type="checkbox" name="isRetroactive" value="true" />
        <span style={{ fontSize: '0.9rem' }}>Mark as retroactive / backfill-related</span>
      </label>
      <button type="submit" style={btnStyle}>
        Generate draft invoice
      </button>
      {msg(state)}
    </form>
  );
}

export function FinalizeInvoiceForm() {
  const [state, action] = useFormState(finalizeInvoiceAction, initial);
  return (
    <form action={action} style={{ marginBottom: '1.25rem' }}>
      <label style={labelStyle}>
        Draft invoice id
        <input name="invoiceId" required placeholder="clx…" style={inputStyle} />
      </label>
      <label style={labelStyle}>
        Optional reason (audit)
        <input name="reason" placeholder="Issued for finance review" style={inputStyle} />
      </label>
      <button type="submit" style={btnStyle}>
        Finalize invoice (issue & lock)
      </button>
      {msg(state)}
    </form>
  );
}

export function LockSnapshotsForm({ defaultInstitutionId }: { defaultInstitutionId: string }) {
  const [state, action] = useFormState(lockSnapshotsAction, initial);
  return (
    <form action={action} style={{ marginBottom: '1.25rem' }}>
      <label style={labelStyle}>
        Institution id
        <input name="institutionId" required defaultValue={defaultInstitutionId} style={inputStyle} />
      </label>
      <label style={labelStyle}>
        Entity id (optional)
        <input name="entityId" placeholder="Limit to one campus" style={inputStyle} />
      </label>
      <label style={labelStyle}>
        From (UTC, YYYY-MM-DD)
        <input name="fromDate" required pattern="\d{4}-\d{2}-\d{2}" placeholder="2026-04-01" style={inputStyle} />
      </label>
      <label style={labelStyle}>
        To (UTC, YYYY-MM-DD)
        <input name="toDate" required pattern="\d{4}-\d{2}-\d{2}" placeholder="2026-04-30" style={inputStyle} />
      </label>
      <label style={labelStyle}>
        Mandatory reason (min 10 chars)
        <textarea name="reason" required minLength={10} rows={3} style={{ ...inputStyle, maxWidth: 480 }} />
      </label>
      <button type="submit" style={{ ...btnStyle, background: '#0f172a', borderColor: '#0f172a' }}>
        Lock snapshot range
      </button>
      {msg(state)}
    </form>
  );
}

export function UnlockSnapshotsForm({ defaultInstitutionId }: { defaultInstitutionId: string }) {
  const [state, action] = useFormState(unlockSnapshotsAction, initial);
  return (
    <form action={action} style={{ marginBottom: '1.25rem' }}>
      <label style={labelStyle}>
        Institution id
        <input name="institutionId" required defaultValue={defaultInstitutionId} style={inputStyle} />
      </label>
      <label style={labelStyle}>
        Entity id (optional)
        <input name="entityId" style={inputStyle} />
      </label>
      <label style={labelStyle}>
        From (UTC, YYYY-MM-DD)
        <input name="fromDate" required pattern="\d{4}-\d{2}-\d{2}" style={inputStyle} />
      </label>
      <label style={labelStyle}>
        To (UTC, YYYY-MM-DD)
        <input name="toDate" required pattern="\d{4}-\d{2}-\d{2}" style={inputStyle} />
      </label>
      <label style={labelStyle}>
        Mandatory reason (min 10 chars)
        <textarea name="reason" required minLength={10} rows={3} style={{ ...inputStyle, maxWidth: 480 }} />
      </label>
      <button type="submit" style={{ ...btnStyle, background: '#b45309', borderColor: '#b45309' }}>
        Unlock snapshot range
      </button>
      {msg(state)}
    </form>
  );
}
