'use client';

import { useActionState } from 'react';
import { resolveBillingDisputeAction } from '@/app/actions/platform';

export function ResolveDisputeForm({
  disputeId,
  bearerConfigured,
}: {
  disputeId: string;
  bearerConfigured: boolean;
}) {
  const boundAction = resolveBillingDisputeAction.bind(null, disputeId);
  const [state, action, pending] = useActionState(boundAction, null);

  if (!bearerConfigured) {
    return (
      <p style={{ color: '#fbbf24', fontSize: '0.9rem' }}>
        Configure ADMIN_API_BEARER to resolve disputes.
      </p>
    );
  }

  const inputStyle = {
    width: '100%',
    padding: '0.5rem 0.65rem',
    borderRadius: 6,
    border: '1px solid #334155',
    background: '#0f172a',
    color: '#f1f5f9',
    fontSize: '0.9rem',
  } as const;

  return (
    <form action={action} style={{ display: 'grid', gap: '1rem', maxWidth: 400, marginTop: '1.5rem' }}>
      <div>
        <label htmlFor="resolution" style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: 4 }}>
          Resolution
        </label>
        <select id="resolution" name="resolution" required style={inputStyle} defaultValue="">
          <option value="" disabled>
            Select…
          </option>
          <option value="ACCEPT">ACCEPT</option>
          <option value="REJECT">REJECT</option>
        </select>
      </div>
      <div>
        <label htmlFor="notes" style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: 4 }}>
          Notes (optional)
        </label>
        <textarea id="notes" name="notes" rows={4} style={{ ...inputStyle, resize: 'vertical' }} />
      </div>
      {state?.error ? (
        <p style={{ color: '#f87171', fontSize: '0.85rem', margin: 0 }}>{state.error}</p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        style={{
          padding: '0.6rem 1rem',
          borderRadius: 6,
          border: 'none',
          background: pending ? '#334155' : '#dc2626',
          color: '#fff',
          fontWeight: 600,
          cursor: pending ? 'wait' : 'pointer',
        }}
      >
        {pending ? 'Submitting…' : 'Resolve dispute'}
      </button>
    </form>
  );
}
