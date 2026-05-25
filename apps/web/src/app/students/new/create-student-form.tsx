'use client';

import { useFormState, useFormStatus } from 'react-dom';
import Link from 'next/link';
import { createStudent, type CreateStudentState } from './actions';

export type ProgramOption = {
  id: string;
  code: string;
  name: string;
  department: { code: string; name: string };
};

const initialState: CreateStudentState = {};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} style={{ padding: '0.65rem 1rem', fontWeight: 600 }}>
      {pending ? 'Creating…' : 'Create student'}
    </button>
  );
}

export function CreateStudentForm({ programs }: { programs: ProgramOption[] }) {
  const [state, formAction] = useFormState(createStudent, initialState);

  return (
    <form action={formAction} style={{ display: 'grid', gap: '1rem', maxWidth: 480 }}>
      {state.error ? (
        <p role="alert" style={{ color: '#b91c1c', margin: 0, fontSize: '0.9rem' }}>
          {state.error}
        </p>
      ) : null}

      <label style={{ display: 'grid', gap: 4 }}>
        <span>Program</span>
        <select name="programId" required style={{ padding: '0.5rem' }} defaultValue="">
          <option value="" disabled>
            Select a program
          </option>
          {programs.map((p) => (
            <option key={p.id} value={p.id}>
              {p.code} — {p.name} ({p.department.code})
            </option>
          ))}
        </select>
      </label>

      <label style={{ display: 'grid', gap: 4 }}>
        <span>Email</span>
        <input
          name="email"
          type="email"
          required
          autoComplete="email"
          style={{ padding: '0.5rem' }}
        />
      </label>

      <label style={{ display: 'grid', gap: 4 }}>
        <span>Temporary password</span>
        <input
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          style={{ padding: '0.5rem' }}
        />
        <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
          Minimum 8 characters. Student should change it after first login.
        </span>
      </label>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
        <label style={{ display: 'grid', gap: 4 }}>
          <span>First name</span>
          <input
            name="firstName"
            required
            maxLength={120}
            autoComplete="given-name"
            style={{ padding: '0.5rem' }}
          />
        </label>
        <label style={{ display: 'grid', gap: 4 }}>
          <span>Last name</span>
          <input
            name="lastName"
            required
            maxLength={120}
            autoComplete="family-name"
            style={{ padding: '0.5rem' }}
          />
        </label>
      </div>

      <label style={{ display: 'grid', gap: 4 }}>
        <span>Current level (optional)</span>
        <input
          name="currentLevel"
          type="number"
          min={1}
          defaultValue={1}
          style={{ padding: '0.5rem' }}
        />
      </label>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
        <label style={{ display: 'grid', gap: 4 }}>
          <span>Admission date</span>
          <input name="admissionDate" type="date" style={{ padding: '0.5rem' }} />
        </label>
        <label style={{ display: 'grid', gap: 4 }}>
          <span>Expected graduation</span>
          <input name="expectedGraduationDate" type="date" style={{ padding: '0.5rem' }} />
        </label>
      </div>

      <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginTop: '0.5rem' }}>
        <SubmitButton />
        <Link href="/dashboard/students" style={{ color: '#64748b' }}>
          Cancel
        </Link>
      </div>
    </form>
  );
}
