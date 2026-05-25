'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition, type CSSProperties } from 'react';
import {
  dismissRegistrationRequestAction,
  markRegistrationRequestReviewedAction,
} from '@/app/actions/registration-requests';

export function RegistrationRequestRowActions({
  requestId,
  canProvision,
}: {
  requestId: string;
  canProvision: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState<'dismiss' | 'review' | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function run(action: 'dismiss' | 'review') {
    setMessage(null);
    setError(null);
    startTransition(async () => {
      const result =
        action === 'dismiss'
          ? await dismissRegistrationRequestAction(requestId)
          : await markRegistrationRequestReviewedAction(requestId);
      if (result?.error) {
        setError(result.error);
        return;
      }
      setConfirming(null);
      setMessage(
        action === 'dismiss' ? 'Request dismissed.' : 'Request approved for provisioning.',
      );
      router.refresh();
    });
  }

  return (
    <div style={wrapperStyle}>
      <div
        style={{ display: 'flex', gap: 6, alignItems: 'center', height: '100%', flexWrap: 'wrap' }}
      >
        {canProvision ? (
          <Link
            href={`/institutions/new?requestId=${encodeURIComponent(requestId)}`}
            style={{
              color: '#2563eb',
              fontSize: '0.8rem',
              fontWeight: 600,
              whiteSpace: 'nowrap',
            }}
          >
            Provision
          </Link>
        ) : null}
        <button
          type="button"
          disabled={pending}
          onClick={() => setConfirming('review')}
          style={actionBtnStyle}
        >
          Approve
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => setConfirming('dismiss')}
          style={actionBtnStyle}
        >
          Dismiss
        </button>
      </div>
      {confirming ? (
        <div style={confirmStyle}>
          <span>
            {confirming === 'review'
              ? 'Approve this request for provisioning?'
              : 'Dismiss this request?'}
          </span>
          <button
            type="button"
            disabled={pending}
            onClick={() => run(confirming)}
            style={confirmBtnStyle}
          >
            {pending ? 'Working...' : 'Confirm'}
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => setConfirming(null)}
            style={actionBtnStyle}
          >
            Cancel
          </button>
        </div>
      ) : null}
      {message ? <p style={successStyle}>{message}</p> : null}
      {error ? <p style={errorStyle}>{error}</p> : null}
    </div>
  );
}

const wrapperStyle: CSSProperties = {
  display: 'grid',
  gap: 6,
};

const actionBtnStyle: CSSProperties = {
  background: 'transparent',
  border: '1px solid #334155',
  color: '#94a3b8',
  borderRadius: 4,
  padding: '2px 8px',
  fontSize: '0.75rem',
  cursor: 'pointer',
};

const confirmStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  flexWrap: 'wrap',
  padding: '0.45rem',
  borderRadius: 6,
  background: '#0f172a',
  border: '1px solid #334155',
  color: '#cbd5e1',
  fontSize: '0.75rem',
};

const confirmBtnStyle: CSSProperties = {
  ...actionBtnStyle,
  color: '#f8fafc',
  borderColor: '#2563eb',
  background: '#2563eb',
};

const successStyle: CSSProperties = {
  margin: 0,
  color: '#22c55e',
  fontSize: '0.75rem',
};

const errorStyle: CSSProperties = {
  margin: 0,
  color: '#f87171',
  fontSize: '0.75rem',
};
