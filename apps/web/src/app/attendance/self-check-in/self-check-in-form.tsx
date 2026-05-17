'use client';

import { FormEvent, useState } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { buildClientFetchHeaders } from '@/lib/client-api-headers';

const apiPublic = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

const primary = '#1e3a5f';

export function AttendanceSelfCheckInForm() {
  const { data: session, status } = useSession();
  const [token, setToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const headers = buildClientFetchHeaders(session);
      if (!headers) {
        setError('Not signed in');
        return;
      }
      const res = await fetch(`${apiPublic}/attendance/self-check-in`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ token: token.trim() }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(
          typeof body?.message === 'string' ? body.message : `${res.status} ${res.statusText}`,
        );
        return;
      }
      setMessage('Attendance submitted as PRESENT for this session date.');
      setToken('');
    } finally {
      setBusy(false);
    }
  }

  if (status === 'loading') {
    return <p style={{ color: '#64748b' }}>Loading session…</p>;
  }

  if (!session?.accessToken || session.user.role !== 'STUDENT') {
    return (
      <p style={{ color: '#475569' }}>
        Student sign-in required.{' '}
        <Link href="/login" style={{ color: primary, fontWeight: 600 }}>
          Sign in
        </Link>
      </p>
    );
  }

  if (!session.user.studentId) {
    return (
      <p style={{ color: '#b91c1c' }}>Your account is not linked to an active student record.</p>
    );
  }

  return (
    <section>
      <form onSubmit={onSubmit} style={{ display: 'grid', gap: '0.75rem' }}>
        <label
          style={{ fontSize: '0.9rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}
        >
          Paste session token from your instructor QR
          <textarea
            value={token}
            onChange={(ev) => setToken(ev.target.value)}
            rows={6}
            required
            style={{
              padding: '0.6rem',
              borderRadius: 8,
              border: '1px solid #cbd5e1',
              fontFamily: 'ui-monospace',
            }}
          />
        </label>
        <button
          type="submit"
          disabled={busy}
          style={{
            padding: '0.65rem',
            borderRadius: 8,
            border: 'none',
            background: busy ? '#94a3b8' : primary,
            color: '#fff',
            fontWeight: 600,
            cursor: busy ? 'not-allowed' : 'pointer',
          }}
        >
          {busy ? 'Submitting…' : 'Check in'}
        </button>
      </form>
      {message ? (
        <p style={{ marginTop: '1rem', color: '#15803d', fontSize: '0.92rem', fontWeight: 600 }}>
          {message}
        </p>
      ) : null}
      {error ? (
        <p style={{ marginTop: '1rem', color: '#b91c1c', fontSize: '0.92rem', fontWeight: 600 }}>
          {error}
        </p>
      ) : null}
    </section>
  );
}
