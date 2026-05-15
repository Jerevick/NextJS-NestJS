'use client';

import { useEffect } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { useRouter } from 'next/navigation';
import { bulkEnrollStudents, type BulkEnrollState } from './actions';

const initial: BulkEnrollState = {};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} style={{ padding: '0.6rem 1rem', fontWeight: 600 }}>
      {pending ? 'Enrolling…' : 'Run bulk enroll'}
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
        <label style={{ display: 'grid', gap: 6 }}>
          <span style={{ fontWeight: 600 }}>Student ids</span>
          <textarea
            name="studentIds"
            required
            rows={12}
            placeholder={'Paste one student id per line (from CSV export “id” column or the profile URL).\nExample:\ncm123abc...\ncm456def...'}
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
            <div style={{ maxHeight: 240, overflow: 'auto', border: '1px solid #e2e8f0', borderRadius: 6 }}>
              <table style={{ width: '100%', fontSize: '0.8rem', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', textAlign: 'left' }}>
                    <th style={{ padding: '0.35rem 0.5rem' }}>Student id</th>
                    <th style={{ padding: '0.35rem 0.5rem' }}>Result</th>
                  </tr>
                </thead>
                <tbody>
                  {state.lines.map((l) => (
                    <tr key={l.studentId} style={{ borderTop: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '0.35rem 0.5rem', fontFamily: 'monospace', wordBreak: 'break-all' }}>{l.studentId}</td>
                      <td style={{ padding: '0.35rem 0.5rem', color: l.ok ? '#15803d' : '#b91c1c' }}>
                        {l.ok ? 'OK' : l.detail ?? 'Failed'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
