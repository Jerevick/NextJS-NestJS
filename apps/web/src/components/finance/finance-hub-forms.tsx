'use client';

import { useState, useTransition } from 'react';
import { createFeeStructureAction } from '@/app/finance/actions';

type AcademicYearOption = { id: string; name: string };

export function FinanceHubForms({
  academicYears,
  canWrite,
}: {
  academicYears: AcademicYearOption[];
  canWrite: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [academicYearId, setAcademicYearId] = useState(academicYears[0]?.id ?? '');
  const [feeCode, setFeeCode] = useState('TUITION');
  const [feeName, setFeeName] = useState('Course tuition');
  const [feeAmount, setFeeAmount] = useState('500');
  const [billedAt, setBilledAt] = useState('ENROLLMENT');

  if (!canWrite) {
    return null;
  }

  return (
    <form
      style={{ marginTop: '1rem', display: 'grid', gap: 10, maxWidth: 480 }}
      onSubmit={(e) => {
        e.preventDefault();
        setMessage(null);
        const amount = Number(feeAmount);
        if (!name.trim() || !academicYearId || !Number.isFinite(amount) || amount < 0) {
          setMessage('Fill in name, academic year, and a valid amount.');
          return;
        }
        startTransition(async () => {
          const result = await createFeeStructureAction({
            name: name.trim(),
            academicYearId,
            isDefault: true,
            items: [
              {
                code: feeCode.trim() || 'FEE',
                name: feeName.trim() || 'Fee',
                amount,
                billedAt,
              },
            ],
          });
          if (result.error) {
            setMessage(result.error);
          } else {
            setMessage('Fee structure created.');
            setName('');
          }
        });
      }}
    >
      <h3 style={{ margin: 0, fontSize: '0.95rem', color: '#334155' }}>New fee structure</h3>
      <label style={{ display: 'grid', gap: 4, fontSize: '0.85rem' }}>
        Name
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          style={{ padding: '0.45rem 0.6rem', borderRadius: 8, border: '1px solid #e2e8f0' }}
        />
      </label>
      <label style={{ display: 'grid', gap: 4, fontSize: '0.85rem' }}>
        Academic year
        <select
          value={academicYearId}
          onChange={(e) => setAcademicYearId(e.target.value)}
          style={{ padding: '0.45rem 0.6rem', borderRadius: 8, border: '1px solid #e2e8f0' }}
        >
          {academicYears.map((y) => (
            <option key={y.id} value={y.id}>
              {y.name}
            </option>
          ))}
        </select>
      </label>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <label style={{ display: 'grid', gap: 4, fontSize: '0.85rem' }}>
          Line code
          <input
            value={feeCode}
            onChange={(e) => setFeeCode(e.target.value)}
            style={{ padding: '0.45rem 0.6rem', borderRadius: 8, border: '1px solid #e2e8f0' }}
          />
        </label>
        <label style={{ display: 'grid', gap: 4, fontSize: '0.85rem' }}>
          Amount
          <input
            type="number"
            min={0}
            step="0.01"
            value={feeAmount}
            onChange={(e) => setFeeAmount(e.target.value)}
            style={{ padding: '0.45rem 0.6rem', borderRadius: 8, border: '1px solid #e2e8f0' }}
          />
        </label>
      </div>
      <label style={{ display: 'grid', gap: 4, fontSize: '0.85rem' }}>
        Line label
        <input
          value={feeName}
          onChange={(e) => setFeeName(e.target.value)}
          style={{ padding: '0.45rem 0.6rem', borderRadius: 8, border: '1px solid #e2e8f0' }}
        />
      </label>
      <label style={{ display: 'grid', gap: 4, fontSize: '0.85rem' }}>
        Billed at
        <select
          value={billedAt}
          onChange={(e) => setBilledAt(e.target.value)}
          style={{ padding: '0.45rem 0.6rem', borderRadius: 8, border: '1px solid #e2e8f0' }}
        >
          <option value="ENROLLMENT">On enrollment</option>
          <option value="PER_COURSE">Per course</option>
        </select>
      </label>
      <button
        type="submit"
        disabled={pending}
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
        {pending ? 'Saving…' : 'Create fee structure'}
      </button>
      {message ? (
        <p
          style={{
            margin: 0,
            fontSize: '0.85rem',
            color: message.includes('failed') ? '#b91c1c' : '#15803d',
          }}
        >
          {message}
        </p>
      ) : null}
    </form>
  );
}
