'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { enrollStudentFromApplication } from './actions';

export function EnrollStudentButton({
  applicationId,
  canWrite,
  hasStudent,
  acceptedStatus,
}: {
  applicationId: string;
  canWrite: boolean;
  hasStudent: boolean;
  acceptedStatus: boolean;
}) {
  const [state, action, pending] = useActionState(enrollStudentFromApplication, null);

  if (hasStudent) {
    return null;
  }

  if (!canWrite) {
    return null;
  }

  if (!acceptedStatus) {
    return (
      <p style={{ marginTop: '0.75rem', fontSize: '0.85rem', color: '#64748b' }}>
        Set status to ACCEPTED before enrolling as a student.
      </p>
    );
  }

  return (
    <div style={{ marginTop: '1rem' }}>
      <form action={action}>
        <input type="hidden" name="applicationId" value={applicationId} />
        <button
          type="submit"
          disabled={pending}
          style={{
            padding: '0.5rem 1rem',
            fontWeight: 600,
            background: '#1e3a5f',
            color: '#fff',
            border: 'none',
            borderRadius: 6,
            cursor: pending ? 'wait' : 'pointer',
          }}
        >
          {pending ? 'Creating student…' : 'Enroll as student'}
        </button>
      </form>
      {state?.error ? (
        <p style={{ color: '#b91c1c', fontSize: '0.85rem', marginTop: '0.5rem' }}>{state.error}</p>
      ) : null}
      {state?.ok ? (
        <p style={{ color: '#15803d', fontSize: '0.85rem', marginTop: '0.5rem' }}>
          {state.ok}
          {state.studentId ? (
            <>
              {' '}
              <Link
                href={`/students/${state.studentId}`}
                style={{ color: '#1e3a5f', fontWeight: 600 }}
              >
                View student →
              </Link>
            </>
          ) : null}
        </p>
      ) : null}
    </div>
  );
}
