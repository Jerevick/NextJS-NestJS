'use client';

import { useEffect } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { useRouter } from 'next/navigation';
import { requestStudentDocument, type RequestDocumentState } from './actions';

const DOC_TYPES = ['TRANSCRIPT', 'ID', 'CERTIFICATE', 'ATTESTATION', 'CLEARANCE'] as const;

const initial: RequestDocumentState = {};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} style={{ padding: '0.5rem 0.85rem', fontWeight: 600 }}>
      {pending ? 'Submitting…' : 'Request document'}
    </button>
  );
}

export function RequestDocumentForm({
  ownerId,
  studentProfilePath,
  readOnly,
}: {
  ownerId: string;
  studentProfilePath: string;
  readOnly?: boolean;
}) {
  const [state, formAction] = useFormState(requestStudentDocument, initial);
  const router = useRouter();

  useEffect(() => {
    if (state.ok) {
      router.refresh();
    }
  }, [state.ok, router]);

  if (readOnly) {
    return (
      <p style={{ color: '#92400e', fontSize: '0.88rem', padding: '0.75rem 0' }}>
        Document requests are disabled while the student is not ACTIVE.
      </p>
    );
  }

  return (
    <form
      action={formAction}
      style={{
        display: 'grid',
        gap: '0.75rem',
        maxWidth: 420,
        padding: '1rem',
        border: '1px solid #e2e8f0',
        borderRadius: 8,
        background: '#fafafa',
      }}
    >
      <input type="hidden" name="ownerId" value={ownerId} />
      <input type="hidden" name="studentProfilePath" value={studentProfilePath} />
      <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b' }}>Creates a document row in REQUESTED status (file generation is a later step).</p>
      {state.error ? (
        <p role="alert" style={{ color: '#b91c1c', margin: 0, fontSize: '0.85rem' }}>
          {state.error}
        </p>
      ) : null}
      {state.ok ? (
        <p style={{ color: '#15803d', margin: 0, fontSize: '0.85rem' }}>{state.ok}</p>
      ) : null}
      <label style={{ display: 'grid', gap: 4, fontSize: '0.85rem' }}>
        <span>Type</span>
        <select name="type" required style={{ padding: '0.45rem' }} defaultValue="TRANSCRIPT">
          {DOC_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </label>
      <label style={{ display: 'grid', gap: 4, fontSize: '0.85rem' }}>
        <span>Title</span>
        <input name="title" required maxLength={500} placeholder="e.g. Official transcript — Fall 2026" style={{ padding: '0.45rem' }} />
      </label>
      <SubmitButton />
    </form>
  );
}
