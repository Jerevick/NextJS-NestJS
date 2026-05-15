'use client';

import { useEffect } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { useRouter } from 'next/navigation';
import { confirmGraduation, type ConfirmGraduationState } from '@/app/students/[id]/actions';

const initial: ConfirmGraduationState = {};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
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
      {pending ? 'Confirming…' : 'Confirm graduation'}
    </button>
  );
}

export function ConfirmGraduationForm({
  studentId,
  studentProfilePath,
  readOnly,
}: {
  studentId: string;
  studentProfilePath: string;
  readOnly?: boolean;
}) {
  const [state, formAction] = useFormState(confirmGraduation, initial);
  const router = useRouter();

  useEffect(() => {
    if (state.ok) {
      router.refresh();
    }
  }, [state.ok, router]);

  if (readOnly) {
    return null;
  }

  return (
    <form
      action={formAction}
      style={{
        marginTop: '1.5rem',
        padding: '1rem',
        border: '1px solid #e2e8f0',
        borderRadius: 8,
        background: '#f8fafc',
      }}
    >
      <h3 style={{ margin: '0 0 0.75rem', fontSize: '0.95rem', color: '#1e3a5f' }}>Confirm graduation</h3>
      <p style={{ margin: '0 0 0.75rem', fontSize: '0.85rem', color: '#64748b' }}>
        Sets enrollment to GRADUATED and stops platform billing for this student.
      </p>
      <input type="hidden" name="studentId" value={studentId} />
      <input type="hidden" name="studentProfilePath" value={studentProfilePath} />
      <label style={{ display: 'block', marginBottom: '0.75rem', fontSize: '0.85rem' }}>
        Justification (required)
        <textarea
          name="reason"
          required
          minLength={3}
          rows={3}
          style={{ display: 'block', width: '100%', marginTop: 4, padding: '0.5rem' }}
          placeholder="Registrar-approved graduation clearance…"
        />
      </label>
      <label style={{ display: 'block', marginBottom: '0.75rem', fontSize: '0.85rem' }}>
        Notes (optional)
        <input
          name="notes"
          type="text"
          style={{ display: 'block', width: '100%', marginTop: 4, padding: '0.5rem' }}
        />
      </label>
      <SubmitButton />
      {state.error ? <p style={{ color: '#b91c1c', fontSize: '0.85rem', marginTop: '0.5rem' }}>{state.error}</p> : null}
      {state.ok ? <p style={{ color: '#15803d', fontSize: '0.85rem', marginTop: '0.5rem' }}>{state.ok}</p> : null}
    </form>
  );
}
