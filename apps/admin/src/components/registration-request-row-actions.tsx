'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTransition, type CSSProperties } from 'react';
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

  function run(action: 'dismiss' | 'review') {
    startTransition(async () => {
      if (action === 'dismiss') {
        await dismissRegistrationRequestAction(requestId);
      } else {
        await markRegistrationRequestReviewedAction(requestId);
      }
      router.refresh();
    });
  }

  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center', height: '100%' }}>
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
      <button type="button" disabled={pending} onClick={() => run('review')} style={actionBtnStyle}>
        Reviewed
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() => run('dismiss')}
        style={actionBtnStyle}
      >
        Dismiss
      </button>
    </div>
  );
}

const actionBtnStyle: CSSProperties = {
  background: 'transparent',
  border: '1px solid #334155',
  color: '#94a3b8',
  borderRadius: 4,
  padding: '2px 8px',
  fontSize: '0.75rem',
  cursor: 'pointer',
};
