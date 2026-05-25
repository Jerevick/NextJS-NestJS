'use client';

import { useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import Link from 'next/link';
import { EnrollConflictHint } from '@/components/enrollment/enroll-conflict-hint';
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

export function EnrollSectionForm({
  studentId,
  sections,
  accessToken,
  apiBase,
}: {
  studentId: string;
  sections: SectionOption[];
  accessToken: string;
  apiBase: string;
}) {
  const [state, formAction] = useFormState(enrollInSection, initial);
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);

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
      {state.success ? <p style={{ color: '#166534', margin: 0 }}>{state.success}</p> : null}
      <label
        style={{
          display: 'flex',
          gap: 8,
          alignItems: 'center',
          fontSize: '0.9rem',
          color: '#475569',
        }}
      >
        <input type="checkbox" name="waitlistIfFull" />
        If section is full, add to waitlist instead of failing
      </label>
      <label
        style={{
          display: 'flex',
          gap: 8,
          alignItems: 'center',
          fontSize: '0.9rem',
          color: '#475569',
        }}
      >
        <input type="checkbox" name="allowInterEntity" />
        Allow inter-entity enrollment (requires institution setting + institution-wide access)
      </label>
      <div
        style={{
          display: 'grid',
          gap: '0.65rem',
          padding: '0.85rem',
          border: '1px solid #e2e8f0',
          borderRadius: 8,
          background: '#f8fafc',
        }}
      >
        <p style={{ margin: 0, fontWeight: 600, color: '#1e293b', fontSize: '0.9rem' }}>
          Repeat / progression context (optional)
        </p>
        <label
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
            fontSize: '0.85rem',
            color: '#475569',
          }}
        >
          Enrollment attempt number
          <input
            type="number"
            name="enrollmentAttemptNumber"
            min={1}
            defaultValue={1}
            style={{ padding: '0.45rem 0.5rem', borderRadius: 6, border: '1px solid #cbd5e1' }}
          />
        </label>
        <label
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
            fontSize: '0.85rem',
            color: '#475569',
          }}
        >
          Original semester ID (repeat reference)
          <input
            type="text"
            name="originalSemesterId"
            placeholder="Semester UUID if repeating / linking prior term"
            style={{ padding: '0.45rem 0.5rem', borderRadius: 6, border: '1px solid #cbd5e1' }}
          />
        </label>
      </div>
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
              <input
                type="radio"
                name="sectionId"
                value={s.id}
                required
                style={{ marginTop: 4 }}
                onChange={() => setSelectedSectionId(s.id)}
              />
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
      <EnrollConflictHint
        studentId={studentId}
        sectionId={selectedSectionId}
        accessToken={accessToken}
        apiBase={apiBase}
      />
      <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
        <SubmitButton />
        <Link href={`/dashboard/students/${studentId}`} style={{ color: '#64748b' }}>
          Cancel
        </Link>
      </div>
    </form>
  );
}
