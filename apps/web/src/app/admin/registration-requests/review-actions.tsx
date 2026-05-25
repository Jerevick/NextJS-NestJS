'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import styles from './registration-requests.module.css';
import { reviewRegistrationRequest } from './actions';

type ReviewDecision = 'REVIEWED' | 'DISMISSED';

export function ReviewActions({
  requestId,
  status,
}: {
  requestId: string;
  status: 'PENDING' | 'REVIEWED' | 'PROVISIONED' | 'DISMISSED';
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<ReviewDecision | null>(null);

  if (status !== 'PENDING') {
    return (
      <div className={styles.reviewComplete}>
        <p className={styles.reviewedNote}>
          This request was already{' '}
          {status === 'PROVISIONED'
            ? 'provisioned'
            : status === 'REVIEWED'
              ? 'approved for provisioning'
              : 'dismissed'}
          .
        </p>
        {status === 'REVIEWED' ? (
          <Link
            href={`/dashboard/admin/institutions/new?requestId=${encodeURIComponent(requestId)}`}
            className={styles.reviewNextLink}
          >
            Provision institution →
          </Link>
        ) : null}
      </div>
    );
  }

  function decide(nextStatus: ReviewDecision) {
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      const result = await reviewRegistrationRequest(requestId, nextStatus);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setConfirming(null);
      setSuccess(
        nextStatus === 'REVIEWED'
          ? 'Request approved for provisioning. The applicant has been notified.'
          : 'Request dismissed. The applicant has been notified.',
      );
      router.refresh();
    });
  }

  return (
    <div>
      <div className={styles.reviewBar}>
        <button
          type="button"
          className={`${styles.reviewBtn} ${styles.approveBtn}`}
          onClick={() => setConfirming('REVIEWED')}
          disabled={isPending}
        >
          Approve for provisioning
        </button>
        <button
          type="button"
          className={`${styles.reviewBtn} ${styles.dismissBtn}`}
          onClick={() => setConfirming('DISMISSED')}
          disabled={isPending}
        >
          Dismiss request
        </button>
      </div>
      {confirming ? (
        <div className={styles.reviewConfirm} role="alert">
          <p>
            {confirming === 'REVIEWED'
              ? 'Approve this request for provisioning? This marks it reviewed and emails the applicant that onboarding is moving forward.'
              : 'Dismiss this request? This closes the request and emails the applicant that UniCore cannot proceed at this time.'}
          </p>
          <div className={styles.reviewConfirmActions}>
            <button
              type="button"
              className={`${styles.reviewBtn} ${
                confirming === 'REVIEWED' ? styles.approveBtn : styles.dismissBtn
              }`}
              onClick={() => decide(confirming)}
              disabled={isPending}
            >
              {isPending
                ? 'Working...'
                : confirming === 'REVIEWED'
                  ? 'Confirm approval'
                  : 'Confirm dismissal'}
            </button>
            <button
              type="button"
              className={`${styles.reviewBtn} ${styles.cancelBtn}`}
              onClick={() => setConfirming(null)}
              disabled={isPending}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}
      <p className={styles.reviewedNote} style={{ marginTop: '0.55rem' }}>
        Decisions notify platform super-administrators and email the submitted contact and
        institution addresses.
      </p>
      {success ? <p className={styles.reviewSuccess}>{success}</p> : null}
      {error ? <p className={styles.reviewError}>{error}</p> : null}
    </div>
  );
}
