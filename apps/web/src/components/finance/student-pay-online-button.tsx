'use client';

import { useState, useTransition } from 'react';
import { initiateOnlinePaymentAction } from '@/app/finance/actions';

export function StudentPayOnlineButton({
  studentId,
  balance,
  currency,
}: {
  studentId: string;
  balance: number;
  currency: string;
}) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  if (balance <= 0) {
    return null;
  }

  return (
    <div style={{ marginTop: '0.75rem' }}>
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          setMessage(null);
          const amount = Math.min(balance, balance);
          const origin = typeof window !== 'undefined' ? window.location.origin : '';
          startTransition(async () => {
            const r = await initiateOnlinePaymentAction(studentId, {
              amount,
              description: 'Student account payment',
              successUrl: `${origin}/dashboard/students/${studentId}?tab=financial&paid=1`,
              cancelUrl: `${origin}/dashboard/students/${studentId}?tab=financial`,
            });
            if (r.error) {
              setMessage(r.error);
              return;
            }
            if (r.paymentUrl) {
              window.location.href = r.paymentUrl;
            } else {
              setMessage(
                'Gateway not configured (set entity.settings.paymentGateway to stripe and STRIPE_SECRET_KEY).',
              );
            }
          });
        }}
        style={{
          padding: '0.55rem 1rem',
          borderRadius: 8,
          border: 'none',
          background: '#2563eb',
          color: '#fff',
          fontWeight: 600,
          cursor: pending ? 'wait' : 'pointer',
        }}
      >
        {pending ? 'Opening checkout…' : `Pay ${currency} ${balance.toFixed(2)} online`}
      </button>
      {message ? (
        <p style={{ margin: '0.5rem 0 0', fontSize: '0.85rem', color: '#b45309' }}>{message}</p>
      ) : null}
    </div>
  );
}
