'use client';

import { useState, useTransition } from 'react';
import { createBulkChargeAction } from '@/app/finance/actions';

type ProgramOption = { id: string; name: string; code: string };

export function FinanceBulkChargeForm({
  programs,
  canWrite,
}: {
  programs: ProgramOption[];
  canWrite: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [programId, setProgramId] = useState(programs[0]?.id ?? '');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');

  if (!canWrite) {
    return null;
  }

  return (
    <form
      style={{ marginTop: '1rem', display: 'grid', gap: 10, maxWidth: 480 }}
      onSubmit={(e) => {
        e.preventDefault();
        setMessage(null);
        const n = Number(amount);
        if (!programId || !Number.isFinite(n) || n <= 0 || !description.trim()) {
          setMessage('Select a programme, amount, and description.');
          return;
        }
        startTransition(async () => {
          const r = await createBulkChargeAction({
            programId,
            amount: n,
            description: description.trim(),
          });
          if (r.error) {
            setMessage(r.error);
          } else {
            setMessage(
              `Bulk charge ${r.mode === 'queued' ? 'queued' : 'completed'} — ${r.successCount ?? 0} posted, ${r.failCount ?? 0} failed.`,
            );
            setAmount('');
            setDescription('');
          }
        });
      }}
    >
      <h3 style={{ margin: 0, fontSize: '0.95rem', color: '#334155' }}>Bulk programme charge</h3>
      <p style={{ margin: 0, fontSize: '0.82rem', color: '#64748b' }}>
        Charges all ACTIVE students in the programme (idempotent per job).
      </p>
      <label style={{ display: 'grid', gap: 4, fontSize: '0.85rem' }}>
        Programme
        <select
          value={programId}
          onChange={(e) => setProgramId(e.target.value)}
          style={{ padding: '0.45rem 0.6rem', borderRadius: 8, border: '1px solid #e2e8f0' }}
        >
          {programs.map((p) => (
            <option key={p.id} value={p.id}>
              {p.code} — {p.name}
            </option>
          ))}
        </select>
      </label>
      <label style={{ display: 'grid', gap: 4, fontSize: '0.85rem' }}>
        Amount per student
        <input
          type="number"
          min={0.01}
          step="0.01"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          style={{ padding: '0.45rem 0.6rem', borderRadius: 8, border: '1px solid #e2e8f0' }}
        />
      </label>
      <label style={{ display: 'grid', gap: 4, fontSize: '0.85rem' }}>
        Description
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Semester tuition — batch"
          style={{ padding: '0.45rem 0.6rem', borderRadius: 8, border: '1px solid #e2e8f0' }}
        />
      </label>
      <button
        type="submit"
        disabled={pending || programs.length <= 0}
        style={{
          padding: '0.55rem 1rem',
          borderRadius: 8,
          border: 'none',
          background: '#1e3a5f',
          color: '#fff',
          fontWeight: 600,
          cursor: pending ? 'wait' : 'pointer',
        }}
      >
        {pending ? 'Running…' : 'Run bulk charge'}
      </button>
      {message ? (
        <p
          style={{
            margin: 0,
            fontSize: '0.85rem',
            color: message.includes('failed') || message.includes('Select') ? '#b91c1c' : '#15803d',
          }}
        >
          {message}
        </p>
      ) : null}
    </form>
  );
}
