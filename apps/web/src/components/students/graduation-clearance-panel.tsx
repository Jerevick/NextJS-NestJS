'use client';

import { useFormState, useFormStatus } from 'react-dom';
import {
  requestGraduationClearance,
  type GraduationClearanceFormState,
} from '@/app/students/[id]/graduation-clearance-actions';

export type GraduationClearanceRow = {
  id: string;
  status: string;
  workflowInstanceId: string | null;
  departmentChecks: Array<{ department: string; label: string; status: string }>;
  clearedAt: string | null;
  createdAt: string;
};

const initial: GraduationClearanceFormState = {};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      style={{ padding: '0.45rem 0.85rem', fontWeight: 600 }}
    >
      {pending ? 'Submitting…' : 'Start graduation clearance'}
    </button>
  );
}

export function GraduationClearancePanel({
  studentId,
  requests,
  readOnly,
}: {
  studentId: string;
  requests: GraduationClearanceRow[];
  readOnly: boolean;
}) {
  const [state, action] = useFormState(requestGraduationClearance, initial);
  const active = requests.find((r) => r.status === 'PENDING' || r.status === 'IN_PROGRESS');
  const cleared = requests.find((r) => r.status === 'CLEARED');

  return (
    <section style={{ marginTop: '1.5rem' }}>
      <h3 style={{ margin: '0 0 0.5rem', fontSize: '1.1rem', color: '#1e3a5f' }}>
        Graduation clearance
      </h3>
      <p style={{ margin: '0 0 0.75rem', fontSize: '0.85rem', color: '#64748b' }}>
        Multi-department workflow (programme → HoD → Dean → Registrar → Finance). After clearance,
        use Confirm graduation to set status GRADUATED.
      </p>

      {cleared ? (
        <p style={{ color: '#166534', fontWeight: 600, marginBottom: '0.75rem' }}>
          Cleared {cleared.clearedAt ? new Date(cleared.clearedAt).toLocaleDateString() : ''}
        </p>
      ) : null}

      {active ? (
        <div
          style={{
            padding: '0.75rem',
            border: '1px solid #bfdbfe',
            borderRadius: 8,
            background: '#eff6ff',
            marginBottom: '1rem',
          }}
        >
          <p style={{ margin: 0, fontWeight: 600 }}>In progress ({active.status})</p>
          {active.workflowInstanceId ? (
            <p style={{ margin: '0.35rem 0 0', fontSize: '0.85rem' }}>
              <a href={`/workflow/${active.workflowInstanceId}`} style={{ color: '#2563eb' }}>
                Open workflow →
              </a>
            </p>
          ) : null}
          <ul style={{ margin: '0.5rem 0 0', paddingLeft: '1.1rem', fontSize: '0.85rem' }}>
            {active.departmentChecks.map((d) => (
              <li key={d.department}>
                {d.label}: <strong>{d.status}</strong>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {!readOnly && !active ? (
        <form action={action} style={{ display: 'grid', gap: '0.65rem', maxWidth: 480 }}>
          <input type="hidden" name="studentId" value={studentId} />
          {state.error ? (
            <p role="alert" style={{ color: '#b91c1c', margin: 0 }}>
              {state.error}
            </p>
          ) : null}
          {state.success ? <p style={{ color: '#166534', margin: 0 }}>{state.success}</p> : null}
          <label style={{ display: 'grid', gap: 4, fontSize: '0.9rem' }}>
            Justification (optional)
            <textarea name="justification" rows={2} style={{ padding: '0.4rem' }} />
          </label>
          <SubmitButton />
        </form>
      ) : null}
    </section>
  );
}
