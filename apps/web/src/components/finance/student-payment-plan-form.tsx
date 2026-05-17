'use client';

import { useState, useTransition } from 'react';
import { createPaymentPlanAction } from '@/app/finance/actions';

type InstallmentRow = { dueDate: string; amount: number; paidAmount: number; status: string };

export function StudentPaymentPlanForm({
  studentId,
  currency,
  canWrite,
  existingPlans,
}: {
  studentId: string;
  currency: string;
  canWrite: boolean;
  existingPlans: Array<{
    id: string;
    totalAmount: number;
    status: string;
    installments: InstallmentRow[];
  }>;
}) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [total, setTotal] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [installmentAmount, setInstallmentAmount] = useState('');

  return (
    <div style={{ marginTop: '1.25rem' }}>
      <h3 style={{ margin: '0 0 0.65rem', fontSize: '0.95rem', color: '#334155' }}>
        Payment plans
      </h3>
      {existingPlans.length > 0 ? (
        <ul style={{ margin: '0 0 1rem', padding: 0, listStyle: 'none', fontSize: '0.88rem' }}>
          {existingPlans.map((p) => (
            <li key={p.id} style={{ padding: '0.5rem 0', borderBottom: '1px solid #f1f5f9' }}>
              <strong>{p.status}</strong> · {currency} {p.totalAmount.toFixed(2)}
              <ul style={{ margin: '4px 0 0', paddingLeft: '1rem' }}>
                {p.installments.map((i, idx) => (
                  <li key={idx}>
                    {i.dueDate.slice(0, 10)} · {i.amount.toFixed(2)} · {i.status}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      ) : (
        <p style={{ margin: '0 0 0.75rem', fontSize: '0.85rem', color: '#94a3b8' }}>
          No payment plans yet.
        </p>
      )}

      {canWrite ? (
        <form
          style={{ display: 'grid', gap: 8, maxWidth: 360 }}
          onSubmit={(e) => {
            e.preventDefault();
            const totalAmount = Number(total);
            const amt = Number(installmentAmount);
            if (!dueDate || !Number.isFinite(totalAmount) || !Number.isFinite(amt)) {
              setMessage('Enter total, due date, and installment amount.');
              return;
            }
            startTransition(async () => {
              const r = await createPaymentPlanAction(studentId, {
                totalAmount,
                installments: [{ dueDate: new Date(dueDate).toISOString(), amount: amt }],
              });
              setMessage(r.error ?? 'Payment plan created.');
            });
          }}
        >
          <input
            type="number"
            placeholder="Plan total"
            value={total}
            onChange={(e) => setTotal(e.target.value)}
            style={{ padding: '0.45rem 0.6rem', borderRadius: 8, border: '1px solid #e2e8f0' }}
          />
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            style={{ padding: '0.45rem 0.6rem', borderRadius: 8, border: '1px solid #e2e8f0' }}
          />
          <input
            type="number"
            placeholder="First installment"
            value={installmentAmount}
            onChange={(e) => setInstallmentAmount(e.target.value)}
            style={{ padding: '0.45rem 0.6rem', borderRadius: 8, border: '1px solid #e2e8f0' }}
          />
          <button
            type="submit"
            disabled={pending}
            style={{
              padding: '0.5rem',
              borderRadius: 8,
              border: 'none',
              background: '#1e3a5f',
              color: '#fff',
              fontWeight: 600,
            }}
          >
            Create plan
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
      ) : null}
    </div>
  );
}
