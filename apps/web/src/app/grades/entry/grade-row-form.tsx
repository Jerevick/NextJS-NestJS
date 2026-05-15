'use client';

import { useActionState } from 'react';
import { saveEnrollmentGradeAction } from './actions';

type GradeJson = {
  score?: number;
  letterGrade?: string;
  gradePoints?: number;
  workflowStatus?: string;
};

export function GradeRowForm({
  enrollmentId,
  sectionId,
  studentLabel,
  initialGrade,
}: {
  enrollmentId: string;
  sectionId: string;
  studentLabel: string;
  initialGrade: GradeJson | null;
}) {
  const bound = saveEnrollmentGradeAction.bind(null, enrollmentId, sectionId);
  const [state, action, pending] = useActionState(bound, null);
  const g = initialGrade ?? {};

  return (
    <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
      <td style={{ padding: '0.5rem 0' }}>{studentLabel}</td>
      <td style={{ padding: '0.5rem 0', fontFamily: 'ui-monospace, monospace', fontSize: '0.85rem' }}>
        {g.letterGrade ?? '—'}
        {g.gradePoints !== undefined ? ` (${g.gradePoints})` : ''}
      </td>
      <td style={{ padding: '0.5rem 0' }}>
        <form action={action} style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            name="score"
            type="number"
            min={0}
            max={100}
            step={0.1}
            defaultValue={g.score !== undefined ? String(g.score) : ''}
            placeholder="Score"
            style={{ width: 72, padding: '0.35rem' }}
          />
          <select name="workflowStatus" defaultValue={g.workflowStatus ?? 'DRAFT'} style={{ padding: '0.35rem' }}>
            <option value="DRAFT">Draft</option>
            <option value="SUBMITTED">Submit</option>
            <option value="APPROVED">Approve</option>
          </select>
          <button type="submit" disabled={pending} style={{ padding: '0.35rem 0.6rem', fontSize: '0.8rem' }}>
            {pending ? '…' : 'Save'}
          </button>
          {state?.error ? <span style={{ color: '#b91c1c', fontSize: '0.75rem' }}>{state.error}</span> : null}
          {state?.ok ? <span style={{ color: '#15803d', fontSize: '0.75rem' }}>Saved</span> : null}
        </form>
      </td>
    </tr>
  );
}
