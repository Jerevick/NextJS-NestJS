'use client';

import { useState, useTransition } from 'react';
import {
  postStudentChargeAction,
  postStudentPaymentAction,
  requestFeeWaiverAction,
  requestFinanceRefundAction,
} from '@/app/finance/actions';

export function StudentFinanceActions({
  studentId,
  canWrite,
  enrollmentStatus,
}: {
  studentId: string;
  canWrite: boolean;
  enrollmentStatus: string;
}) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [mode, setMode] = useState<'charge' | 'payment' | 'waiver' | 'refund'>('payment');

  if (!canWrite) {
    return null;
  }

  const inactive = enrollmentStatus !== 'ACTIVE';

  return (
    <div
      style={{
        marginTop: '1.25rem',
        padding: '1rem 1.1rem',
        border: '1px solid #e2e8f0',
        borderRadius: 10,
        background: '#f8fafc',
      }}
    >
      <h3 style={{ margin: '0 0 0.65rem', fontSize: '0.95rem', color: '#334155' }}>
        Ledger actions
      </h3>
      <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
        {(['payment', 'charge', 'waiver', 'refund'] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            disabled={m === 'charge' && inactive}
            title={
              m === 'charge' && inactive ? 'New charges blocked for inactive students' : undefined
            }
            style={{
              padding: '0.35rem 0.75rem',
              borderRadius: 6,
              border: mode === m ? '2px solid #1e3a5f' : '1px solid #cbd5e1',
              background: mode === m ? '#eff6ff' : '#fff',
              fontWeight: 600,
              fontSize: '0.82rem',
              cursor: m === 'charge' && inactive ? 'not-allowed' : 'pointer',
              opacity: m === 'charge' && inactive ? 0.5 : 1,
            }}
          >
            {m === 'payment'
              ? 'Payment'
              : m === 'charge'
                ? 'Charge'
                : m === 'waiver'
                  ? 'Waiver'
                  : 'Refund'}
          </button>
        ))}
      </div>
      <form
        style={{ display: 'grid', gap: 8, maxWidth: 400 }}
        onSubmit={(e) => {
          e.preventDefault();
          setMessage(null);
          const n = Number(amount);
          if (!Number.isFinite(n) || n <= 0 || !description.trim()) {
            setMessage('Enter a positive amount and description.');
            return;
          }
          startTransition(async () => {
            let result: { error?: string; ok?: boolean };
            if (mode === 'payment') {
              result = await postStudentPaymentAction(studentId, {
                amount: n,
                description: description.trim(),
                paymentMethod: 'manual',
              });
            } else if (mode === 'charge') {
              result = await postStudentChargeAction(studentId, {
                amount: n,
                description: description.trim(),
              });
            } else if (mode === 'waiver') {
              result = await requestFeeWaiverAction(studentId, {
                amount: n,
                description: description.trim(),
              });
            } else {
              result = await requestFinanceRefundAction(studentId, {
                amount: n,
                description: description.trim(),
              });
            }
            if (result.error) {
              setMessage(result.error);
            } else {
              const labels = {
                payment: 'Payment recorded.',
                charge: 'Charge recorded.',
                waiver: 'Waiver submitted for approval.',
                refund: 'Refund submitted for approval.',
              };
              setMessage(labels[mode]);
              setAmount('');
              setDescription('');
            }
          });
        }}
      >
        <label style={{ display: 'grid', gap: 4, fontSize: '0.85rem' }}>
          Amount
          <input
            type="number"
            min={0.01}
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
            style={{ padding: '0.45rem 0.6rem', borderRadius: 8, border: '1px solid #e2e8f0' }}
          />
        </label>
        <label style={{ display: 'grid', gap: 4, fontSize: '0.85rem' }}>
          Description
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
            placeholder={
              mode === 'payment'
                ? 'Cash / bank transfer'
                : mode === 'charge'
                  ? 'Lab fee, etc.'
                  : 'Reason for approval workflow'
            }
            style={{ padding: '0.45rem 0.6rem', borderRadius: 8, border: '1px solid #e2e8f0' }}
          />
        </label>
        <button
          type="submit"
          disabled={pending || (mode === 'charge' && inactive) || (mode === 'waiver' && inactive)}
          style={{
            padding: '0.5rem 0.9rem',
            borderRadius: 8,
            border: 'none',
            background: '#1e3a5f',
            color: '#fff',
            fontWeight: 600,
            cursor: pending ? 'wait' : 'pointer',
          }}
        >
          {pending
            ? 'Submitting…'
            : mode === 'payment'
              ? 'Record payment'
              : mode === 'charge'
                ? 'Post charge'
                : mode === 'waiver'
                  ? 'Request waiver'
                  : 'Request refund'}
        </button>
        {message ? (
          <p
            style={{
              margin: 0,
              fontSize: '0.85rem',
              color:
                message.includes('failed') || message.includes('Enter') ? '#b91c1c' : '#15803d',
            }}
          >
            {message}
          </p>
        ) : null}
      </form>
    </div>
  );
}
