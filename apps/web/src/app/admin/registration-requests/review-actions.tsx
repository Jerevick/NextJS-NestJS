'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import styles from './registration-requests.module.css';
import { reviewRegistrationRequest } from './actions';

export function ReviewActions({
  requestId,
  status,
}: {
  requestId: string;
  status: 'PENDING' | 'REVIEWED' | 'DISMISSED';
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (status !== 'PENDING') {
    return (
      <p className={styles.reviewedNote}>
        This request was already {status === 'REVIEWED' ? 'approved' : 'dismissed'}. Re-open via the
        API if a status change is required.
      </p>
    );
  }

  function decide(nextStatus: 'REVIEWED' | 'DISMISSED') {
    setError(null);
    startTransition(async () => {
      const result = await reviewRegistrationRequest(requestId, nextStatus);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div>
      <div className={styles.reviewBar}>
        <button
          type="button"
          className={`${styles.reviewBtn} ${styles.approveBtn}`}
          onClick={() => decide('REVIEWED')}
          disabled={isPending}
        >
          {isPending ? 'Working…' : 'Mark as reviewed'}
        </button>
        <button
          type="button"
          className={`${styles.reviewBtn} ${styles.dismissBtn}`}
          onClick={() => decide('DISMISSED')}
          disabled={isPending}
        >
          Dismiss request
        </button>
      </div>
      <p className={styles.reviewedNote} style={{ marginTop: '0.55rem' }}>
        Decisions notify other platform super-administrators and email the institution contact.
      </p>
      {error ? <p className={styles.reviewError}>{error}</p> : null}
    </div>
  );
}
