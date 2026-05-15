'use client';

import { useFormState, useFormStatus } from 'react-dom';
import Link from 'next/link';
import { enrollInSection, type EnrollSectionState } from './actions';

export type SectionOption = {
  id: string;
  maxEnrollment: number;
  course: { code: string; title: string };
  semester: { id: string; name: string };
};

const initial: EnrollSectionState = {};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} style={{ padding: '0.6rem 1rem', fontWeight: 600 }}>
      {pending ? 'Enrolling…' : 'Confirm enrollment'}
    </button>
  );
}

export function EnrollSectionForm({ studentId, sections }: { studentId: string; sections: SectionOption[] }) {
  const [state, formAction] = useFormState(enrollInSection, initial);

  if (sections.length === 0) {
    return <p style={{ color: '#64748b' }}>No sections are scheduled for this semester.</p>;
  }

  return (
    <form action={formAction} style={{ display: 'grid', gap: '1rem' }}>
      <input type="hidden" name="studentId" value={studentId} />
      {state.error ? (
        <p role="alert" style={{ color: '#b91c1c', margin: 0 }}>
          {state.error}
        </p>
      ) : null}
      <fieldset style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: '1rem' }}>
        <legend style={{ fontWeight: 600 }}>Section</legend>
        <div style={{ display: 'grid', gap: '0.65rem' }}>
          {sections.map((s) => (
            <label
              key={s.id}
              style={{
                display: 'flex',
                gap: '0.5rem',
                alignItems: 'flex-start',
                padding: '0.5rem',
                borderRadius: 6,
                cursor: 'pointer',
              }}
            >
              <input type="radio" name="sectionId" value={s.id} required style={{ marginTop: 4 }} />
              <span>
                <strong>{s.course.code}</strong> {s.course.title}
                <span style={{ color: '#64748b', fontSize: '0.85rem' }}>
                  {' '}
                  · max {s.maxEnrollment} seats
                </span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
        <SubmitButton />
        <Link href={`/students/${studentId}`} style={{ color: '#64748b' }}>
          Cancel
        </Link>
      </div>
    </form>
  );
}
