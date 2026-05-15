'use client';

import { useActionState } from 'react';
import { updateApplicationStatusAction } from './actions';

const STATUSES = [
  'PENDING',
  'UNDER_REVIEW',
  'WAITLISTED',
  'ACCEPTED',
  'REJECTED',
  'WITHDRAWN',
] as const;

export function ApplicationStatusForm({
  applicationId,
  currentStatus,
  canWrite,
}: {
  applicationId: string;
  currentStatus: string;
  canWrite: boolean;
}) {
  const bound = updateApplicationStatusAction.bind(null, applicationId);
  const [state, action, pending] = useActionState(bound, null);

  if (!canWrite) {
    return <p style={{ color: '#64748b', fontSize: '0.9rem' }}>Read-only — requires admissions.write.</p>;
  }

  return (
    <form action={action} style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
      <select name="status" defaultValue={currentStatus} style={{ padding: '0.45rem' }}>
        {STATUSES.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
      <button type="submit" disabled={pending} style={{ padding: '0.45rem 0.85rem', fontWeight: 600 }}>
        {pending ? 'Saving…' : 'Update status'}
      </button>
      {state?.error ? <span style={{ color: '#b91c1c', fontSize: '0.85rem' }}>{state.error}</span> : null}
    </form>
  );
}
