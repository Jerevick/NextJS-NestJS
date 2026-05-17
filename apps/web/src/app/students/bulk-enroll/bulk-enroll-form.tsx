'use client';

import {
  BulkEnrollResultDataGrid,
  type BulkEnrollResultRow,
} from '@/components/data-grids/misc-data-grids';
import { useEffect } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { useRouter } from 'next/navigation';
import { bulkEnrollStudents, type BulkEnrollState } from './actions';

const initial: BulkEnrollState = {};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} style={{ padding: '0.6rem 1rem', fontWeight: 600 }}>
      {pending ? 'Processing job…' : 'Run bulk enroll (BullMQ)'}
    </button>
  );
}

export function BulkEnrollForm({ sectionId }: { sectionId: string }) {
  const [state, formAction] = useFormState(bulkEnrollStudents, initial);
  const router = useRouter();

  useEffect(() => {
    if (state.summary && state.lines?.some((l) => l.ok)) {
      router.refresh();
    }
  }, [state.summary, state.lines, router]);

  return (
    <div style={{ display: 'grid', gap: '1rem', maxWidth: 640 }}>
      <form action={formAction} style={{ display: 'grid', gap: '0.75rem' }}>
        <input type="hidden" name="sectionId" value={sectionId} />
        <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: '0.9rem' }}>
          <input type="checkbox" name="waitlistIfFull" />
          If section is full, add to waitlist
        </label>
        <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: '0.9rem' }}>
          <input type="checkbox" name="allowInterEntity" />
          Allow inter-entity enrollment (institution setting + institution-wide staff only)
        </label>
        <label style={{ display: 'grid', gap: 6 }}>
          <span style={{ fontWeight: 600 }}>Student ids</span>
          <textarea
            name="studentIds"
            required
            rows={12}
            placeholder={
              'Paste one student id per line (from CSV export “id” column or the profile URL).\nExample:\ncm123abc...\ncm456def...'
            }
            style={{ fontFamily: 'monospace', fontSize: '0.85rem', padding: '0.5rem' }}
          />
        </label>
        {state.error ? (
          <p role="alert" style={{ color: '#b91c1c', margin: 0 }}>
            {state.error}
          </p>
        ) : null}
        <SubmitButton />
      </form>
      {state.summary ? (
        <div>
          <p style={{ fontWeight: 600, margin: '0 0 0.5rem' }}>{state.summary}</p>
          {state.lines && state.lines.length > 0 ? (
            <BulkEnrollResultDataGrid
              rows={state.lines.map(
                (l): BulkEnrollResultRow => ({
                  id: l.studentId,
                  studentId: l.studentId,
                  ok: l.ok,
                  result: l.ok ? 'OK' : (l.detail ?? 'Failed'),
                }),
              )}
            />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
