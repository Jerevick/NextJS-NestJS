'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function AlumniEventRegisterButton({
  eventId,
  fee,
  paymentUrl,
  paymentStatus,
}: {
  eventId: string;
  fee: number;
  paymentUrl?: string | null;
  paymentStatus?: string | null;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (paymentStatus === 'COMPLETED' || paymentStatus === 'WAIVED') {
    return (
      <span style={{ color: '#0d9488', fontWeight: 600, fontSize: '0.85rem' }}>Registered</span>
    );
  }

  if (paymentUrl && paymentStatus === 'PENDING') {
    return (
      <a href={paymentUrl} style={{ color: '#2563eb', fontWeight: 600, fontSize: '0.85rem' }}>
        Complete payment →
      </a>
    );
  }

  async function register() {
    setPending(true);
    setError(null);
    const res = await fetch(`/api/portal/alumni/events/${eventId}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    setPending(false);
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setError(data.error ?? `Registration failed (${res.status})`);
      return;
    }
    const data = (await res.json()) as { paymentUrl?: string };
    if (data.paymentUrl) {
      window.location.href = data.paymentUrl;
      return;
    }
    router.refresh();
  }

  return (
    <span>
      <button
        type="button"
        onClick={register}
        disabled={pending}
        style={{
          padding: '0.4rem 0.75rem',
          background: '#0f1729',
          color: '#fff',
          border: 'none',
          borderRadius: 6,
          fontSize: '0.82rem',
          fontWeight: 600,
          cursor: pending ? 'wait' : 'pointer',
        }}
      >
        {pending ? '…' : fee > 0 ? `Register · $${fee}` : 'Register'}
      </button>
      {error ? (
        <span style={{ display: 'block', color: '#b91c1c', fontSize: '0.78rem', marginTop: 4 }}>
          {error}
        </span>
      ) : null}
    </span>
  );
}
