'use client';

import { useState, useTransition } from 'react';
import {
  requestStudentExcessRefundAction,
  requestStudentExcessTransferAction,
} from '@/app/my-finance/actions';

type ExcessSummary = {
  balance: number;
  creditBalance: number;
  scholarshipLocked: number;
  cashTransferable: number;
  reservedForPaymentPlans: number;
  pendingRequests: number;
  maxRefundable: number;
  maxTransferable: number;
  currency: string;
};

export function StudentExcessCreditPanel({
  studentId,
  summary,
}: {
  studentId: string;
  summary: ExcessSummary | null;
}) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [mode, setMode] = useState<'refund' | 'transfer'>('refund');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [targetStudentNumber, setTargetStudentNumber] = useState('');

  if (!summary) {
    return (
      <p style={{ margin: '1rem 0 0', fontSize: '0.88rem', color: '#94a3b8' }}>
        Excess credit details are unavailable right now.
      </p>
    );
  }

  const max = mode === 'refund' ? summary.maxRefundable : summary.maxTransferable;
  const canRequest = max > 0.01;

  return (
    <div
      style={{
        marginTop: '1.25rem',
        padding: '1rem 1.1rem',
        borderRadius: 10,
        border: '1px solid #e2e8f0',
        background: '#f8fafc',
      }}
    >
      <h3 style={{ margin: '0 0 0.5rem', fontSize: '1rem', color: '#334155' }}>
        Excess cash (refund or transfer)
      </h3>
      <p style={{ margin: '0 0 0.75rem', fontSize: '0.82rem', color: '#64748b', lineHeight: 1.5 }}>
        Only cash you paid beyond fees can be refunded or sent to another student. Scholarship
        awards are applied to your fees first and cannot be refunded or transferred, even if your
        balance shows credit.
      </p>

      <dl
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr auto',
          gap: '0.35rem 1rem',
          fontSize: '0.85rem',
          margin: '0 0 1rem',
        }}
      >
        <dt style={{ color: '#64748b' }}>Cash available</dt>
        <dd style={{ margin: 0, fontWeight: 600, textAlign: 'right' }}>
          {summary.currency} {summary.cashTransferable.toFixed(2)}
        </dd>
        <dt style={{ color: '#64748b' }}>Scholarship (locked)</dt>
        <dd style={{ margin: 0, textAlign: 'right', color: '#b45309' }}>
          {summary.currency} {summary.scholarshipLocked.toFixed(2)}
        </dd>
        {summary.reservedForPaymentPlans > 0 ? (
          <>
            <dt style={{ color: '#64748b' }}>Reserved for payment plan</dt>
            <dd style={{ margin: 0, textAlign: 'right' }}>
              {summary.currency} {summary.reservedForPaymentPlans.toFixed(2)}
            </dd>
          </>
        ) : null}
        {summary.pendingRequests > 0 ? (
          <>
            <dt style={{ color: '#64748b' }}>Pending requests</dt>
            <dd style={{ margin: 0, textAlign: 'right' }}>
              {summary.currency} {summary.pendingRequests.toFixed(2)}
            </dd>
          </>
        ) : null}
        <dt style={{ color: '#0f1729' }}>Maximum you may request</dt>
        <dd style={{ margin: 0, fontWeight: 700, textAlign: 'right', color: '#0d9488' }}>
          {summary.currency} {max.toFixed(2)}
        </dd>
      </dl>

      {!canRequest ? (
        <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b' }}>
          No refundable cash balance right now. Paying down upcoming installments or clearing
          outstanding charges may free cash later.
        </p>
      ) : (
        <form
          style={{ display: 'grid', gap: 10, maxWidth: 420 }}
          onSubmit={(e) => {
            e.preventDefault();
            setMessage(null);
            const parsed = Number(amount);
            if (!Number.isFinite(parsed) || parsed <= 0) {
              setMessage('Enter a valid amount.');
              return;
            }
            if (parsed > max + 0.005) {
              setMessage(`Amount cannot exceed ${max.toFixed(2)} ${summary.currency}.`);
              return;
            }
            if (!description.trim()) {
              setMessage('Please add a short reason.');
              return;
            }
            startTransition(async () => {
              if (mode === 'refund') {
                const r = await requestStudentExcessRefundAction(studentId, {
                  amount: parsed,
                  description: description.trim(),
                });
                setMessage(r.error ?? 'Refund request submitted for BURSAR approval.');
              } else {
                if (!targetStudentNumber.trim()) {
                  setMessage('Enter the recipient student number.');
                  return;
                }
                const r = await requestStudentExcessTransferAction(studentId, {
                  amount: parsed,
                  description: description.trim(),
                  targetStudentNumber: targetStudentNumber.trim(),
                });
                setMessage(r.error ?? 'Transfer request submitted for BURSAR approval.');
              }
            });
          }}
        >
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              onClick={() => setMode('refund')}
              style={{
                padding: '0.35rem 0.75rem',
                borderRadius: 8,
                border: mode === 'refund' ? '2px solid #0d9488' : '1px solid #e2e8f0',
                background: mode === 'refund' ? '#ecfdf5' : '#fff',
                cursor: 'pointer',
                fontSize: '0.85rem',
              }}
            >
              Refund to me
            </button>
            <button
              type="button"
              onClick={() => setMode('transfer')}
              style={{
                padding: '0.35rem 0.75rem',
                borderRadius: 8,
                border: mode === 'transfer' ? '2px solid #0d9488' : '1px solid #e2e8f0',
                background: mode === 'transfer' ? '#ecfdf5' : '#fff',
                cursor: 'pointer',
                fontSize: '0.85rem',
              }}
            >
              Transfer to student
            </button>
          </div>

          <label style={{ display: 'grid', gap: 4, fontSize: '0.85rem' }}>
            Amount ({summary.currency})
            <input
              type="number"
              min={0.01}
              max={max}
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
              style={{ padding: '0.45rem 0.6rem', borderRadius: 8, border: '1px solid #e2e8f0' }}
            />
          </label>

          {mode === 'transfer' ? (
            <label style={{ display: 'grid', gap: 4, fontSize: '0.85rem' }}>
              Recipient student number
              <input
                value={targetStudentNumber}
                onChange={(e) => setTargetStudentNumber(e.target.value)}
                required
                placeholder="e.g. STU-2024-001"
                style={{ padding: '0.45rem 0.6rem', borderRadius: 8, border: '1px solid #e2e8f0' }}
              />
            </label>
          ) : null}

          <label style={{ display: 'grid', gap: 4, fontSize: '0.85rem' }}>
            Reason
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              required
              style={{ padding: '0.45rem 0.6rem', borderRadius: 8, border: '1px solid #e2e8f0' }}
            />
          </label>

          <button
            type="submit"
            disabled={pending}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: 8,
              border: 'none',
              background: '#0d9488',
              color: '#fff',
              fontWeight: 600,
              cursor: pending ? 'wait' : 'pointer',
              width: 'fit-content',
            }}
          >
            {pending ? 'Submitting…' : 'Submit for approval'}
          </button>
        </form>
      )}

      {message ? (
        <p
          style={{
            margin: '0.75rem 0 0',
            fontSize: '0.85rem',
            color:
              message.toLowerCase().includes('fail') || message.includes('cannot')
                ? '#b91c1c'
                : '#15803d',
          }}
        >
          {message}
        </p>
      ) : null}
    </div>
  );
}
