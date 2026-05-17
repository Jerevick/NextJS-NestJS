'use client';

import { useFormState, useFormStatus } from 'react-dom';
import {
  liftEnrollmentHold,
  placeEnrollmentHold,
  type HoldFormState,
} from '@/app/students/[id]/enrollment-holds-actions';

export type EnrollmentHoldRow = {
  id: string;
  type: string;
  reason: string;
  placedAt: string;
  liftedAt: string | null;
  liftNotes: string | null;
  placedBy: { email: string };
  liftedBy: { email: string } | null;
};

const holdTypes = ['FINANCIAL', 'ACADEMIC', 'ADMINISTRATIVE', 'LIBRARY', 'DISCIPLINARY'] as const;

const initial: HoldFormState = {};

function PlaceSubmit() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      style={{ padding: '0.45rem 0.85rem', fontWeight: 600 }}
    >
      {pending ? 'Placing…' : 'Place hold'}
    </button>
  );
}

function LiftButton({ holdId, studentId }: { holdId: string; studentId: string }) {
  const [state, action] = useFormState(liftEnrollmentHold, initial);
  return (
    <form action={action} style={{ display: 'inline' }}>
      <input type="hidden" name="holdId" value={holdId} />
      <input type="hidden" name="studentId" value={studentId} />
      <LiftSubmit />
      {state.error ? (
        <span style={{ color: '#b91c1c', fontSize: '0.75rem', marginLeft: 6 }}>{state.error}</span>
      ) : null}
    </form>
  );
}

function LiftSubmit() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      style={{ padding: '0.25rem 0.55rem', fontSize: '0.8rem', fontWeight: 600 }}
    >
      {pending ? '…' : 'Lift'}
    </button>
  );
}

export function EnrollmentHoldsPanel({
  studentId,
  holds,
  readOnly,
}: {
  studentId: string;
  holds: EnrollmentHoldRow[];
  readOnly: boolean;
}) {
  const [placeState, placeAction] = useFormState(placeEnrollmentHold, initial);
  const active = holds.filter((h) => !h.liftedAt);

  return (
    <section style={{ marginTop: '1.5rem' }}>
      <h3 style={{ margin: '0 0 0.5rem', fontSize: '1.1rem', color: '#1e3a5f' }}>
        Enrollment holds
      </h3>
      <p style={{ margin: '0 0 0.75rem', fontSize: '0.85rem', color: '#64748b' }}>
        Holds block new course registration. They do not change billing status — the student stays
        ACTIVE.
      </p>

      {active.length > 0 ? (
        <ul style={{ margin: '0 0 1rem', padding: 0, listStyle: 'none' }}>
          {active.map((h) => (
            <li
              key={h.id}
              style={{
                padding: '0.65rem 0.75rem',
                marginBottom: 8,
                border: '1px solid #fcd34d',
                borderRadius: 8,
                background: '#fffbeb',
              }}
            >
              <strong>{h.type}</strong>
              <span style={{ color: '#64748b', fontSize: '0.85rem' }}>
                {' '}
                · since {new Date(h.placedAt).toLocaleDateString()}
              </span>
              <p style={{ margin: '0.35rem 0 0', fontSize: '0.9rem' }}>{h.reason}</p>
              {!readOnly ? <LiftButton holdId={h.id} studentId={studentId} /> : null}
            </li>
          ))}
        </ul>
      ) : (
        <p style={{ color: '#64748b', fontSize: '0.9rem', marginBottom: '1rem' }}>
          No active holds.
        </p>
      )}

      {!readOnly ? (
        <form action={placeAction} style={{ display: 'grid', gap: '0.65rem', maxWidth: 480 }}>
          <input type="hidden" name="studentId" value={studentId} />
          {placeState.error ? (
            <p role="alert" style={{ color: '#b91c1c', margin: 0 }}>
              {placeState.error}
            </p>
          ) : null}
          {placeState.success ? (
            <p style={{ color: '#166534', margin: 0 }}>{placeState.success}</p>
          ) : null}
          <label style={{ display: 'grid', gap: 4, fontSize: '0.9rem' }}>
            Type
            <select name="type" required style={{ padding: '0.4rem' }}>
              {holdTypes.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
          <label style={{ display: 'grid', gap: 4, fontSize: '0.9rem' }}>
            Reason
            <textarea name="reason" required minLength={3} rows={2} style={{ padding: '0.4rem' }} />
          </label>
          <PlaceSubmit />
        </form>
      ) : null}

      {holds.some((h) => h.liftedAt) ? (
        <details style={{ marginTop: '1rem', fontSize: '0.85rem', color: '#64748b' }}>
          <summary>Lifted holds ({holds.filter((h) => h.liftedAt).length})</summary>
          <ul style={{ paddingLeft: '1.1rem' }}>
            {holds
              .filter((h) => h.liftedAt)
              .map((h) => (
                <li key={h.id} style={{ marginTop: 6 }}>
                  {h.type} — lifted {h.liftedAt ? new Date(h.liftedAt).toLocaleDateString() : ''}
                </li>
              ))}
          </ul>
        </details>
      ) : null}
    </section>
  );
}
