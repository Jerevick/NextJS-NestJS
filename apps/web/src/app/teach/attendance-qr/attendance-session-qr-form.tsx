'use client';

import { FormEvent, useState } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { buildClientFetchHeaders } from '@/lib/client-api-headers';

const apiPublic = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

const primary = '#1e3a5f';

export function AttendanceSessionQrForm() {
  const { data: session, status } = useSession();
  const [sectionId, setSectionId] = useState('');
  const [sessionDate, setSessionDate] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [payload, setPayload] = useState<{
    token: string;
    sessionDate?: string;
    qrDataUrl?: string | null;
  } | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setPayload(null);
    try {
      const headers = buildClientFetchHeaders(session);
      if (!headers) {
        setError('Not signed in');
        return;
      }
      const res = await fetch(
        `${apiPublic}/attendance/sections/${encodeURIComponent(sectionId.trim())}/session-qr`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify({
            sessionDate: sessionDate.trim(),
          }),
        },
      );
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(
          typeof body?.message === 'string' ? body.message : `${res.status} ${res.statusText}`,
        );
        return;
      }
      setPayload({
        token: String(body.token ?? ''),
        sessionDate: body.sessionDate !== undefined ? String(body.sessionDate) : undefined,
        qrDataUrl: body.qrDataUrl ?? undefined,
      });
    } finally {
      setBusy(false);
    }
  }

  if (status === 'loading') {
    return <p style={{ color: '#64748b' }}>Loading session…</p>;
  }

  if (!session?.accessToken) {
    return (
      <p>
        <Link href="/login">Sign in</Link> as faculty with attendance.enter or attendance.write.
      </p>
    );
  }

  return (
    <section>
      <p style={{ color: '#475569', fontSize: '0.95rem' }}>
        Generates a short-lived JWT and QR bitmap for classroom self check-in (<code>PRESENT</code>
        ).
      </p>
      <form
        onSubmit={onSubmit}
        style={{ display: 'grid', gap: '0.75rem', marginTop: '1rem', maxWidth: 420 }}
      >
        <label
          style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.9rem' }}
        >
          Section ID
          <input
            value={sectionId}
            onChange={(ev) => setSectionId(ev.target.value)}
            required
            style={{
              padding: '0.55rem',
              borderRadius: 8,
              border: '1px solid #cbd5e1',
              fontFamily: 'inherit',
            }}
          />
        </label>
        <label
          style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.9rem' }}
        >
          Session date (ISO)
          <input
            type="date"
            value={sessionDate}
            onChange={(ev) => setSessionDate(ev.target.value)}
            required
            style={{
              padding: '0.55rem',
              borderRadius: 8,
              border: '1px solid #cbd5e1',
              fontFamily: 'inherit',
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
          {busy ? 'Working…' : 'Generate QR token'}
        </button>
      </form>
      {error ? (
        <p style={{ marginTop: '1rem', color: '#b91c1c', fontSize: '0.9rem' }}>
          <strong>Error.</strong> {error}
        </p>
      ) : null}
      {payload?.qrDataUrl ? (
        <div style={{ marginTop: '1.5rem' }}>
          <p style={{ fontSize: '0.85rem', color: '#64748b' }}>Encoded token (students scan)</p>
          <img
            alt="Attendance QR"
            src={payload.qrDataUrl}
            style={{ marginTop: '0.5rem', border: '1px solid #e2e8f0' }}
          />
        </div>
      ) : null}
      {payload?.token ? (
        <details style={{ marginTop: '1rem' }}>
          <summary style={{ cursor: 'pointer', color: primary, fontWeight: 600 }}>
            Raw token (debug)
          </summary>
          <pre
            style={{
              marginTop: '0.5rem',
              padding: '0.75rem',
              background: '#f8fafc',
              borderRadius: 8,
              fontSize: '0.75rem',
              overflow: 'auto',
            }}
          >
            {payload.token}
          </pre>
        </details>
      ) : null}
    </section>
  );
}
