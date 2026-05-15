'use client';

import { useEffect } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { useRouter } from 'next/navigation';
import { dropEnrollment, type DropEnrollmentState } from './actions';

const initial: DropEnrollmentState = {};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      style={{
        fontSize: '0.75rem',
        padding: '0.2rem 0.45rem',
        color: '#b91c1c',
        border: '1px solid #fecaca',
        background: '#fef2f2',
        borderRadius: 4,
        cursor: pending ? 'wait' : 'pointer',
      }}
    >
      {pending ? '…' : 'Drop'}
    </button>
  );
}

export function DropEnrollmentForm({
  enrollmentId,
  studentProfilePath,
  readOnly,
}: {
  enrollmentId: string;
  studentProfilePath: string;
  readOnly?: boolean;
}) {
  const [state, formAction] = useFormState(dropEnrollment, initial);
  const router = useRouter();

  useEffect(() => {
    if (state.ok) {
      router.refresh();
    }
  }, [state.ok, router]);

  if (readOnly) {
    return <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>—</span>;
  }

  return (
    <form action={formAction} style={{ display: 'inline-flex', flexDirection: 'column', gap: 2, alignItems: 'flex-start' }}>
      <input type="hidden" name="enrollmentId" value={enrollmentId} />
      <input type="hidden" name="studentProfilePath" value={studentProfilePath} />
      <SubmitButton />
      {state.error ? (
        <span style={{ fontSize: '0.7rem', color: '#b91c1c', maxWidth: 140 }}>{state.error}</span>
      ) : null}
      {state.ok ? (
        <span style={{ fontSize: '0.7rem', color: '#15803d' }}>{state.ok}</span>
      ) : null}
    </form>
  );
}
