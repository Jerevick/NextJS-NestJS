'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { verifyVoteTokenAction } from '@/app/elections/actions';

export default function VerifyVotePage() {
  const [token, setToken] = useState('');
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <main style={{ padding: '2rem', maxWidth: 560, margin: '0 auto', fontFamily: 'system-ui' }}>
      <p style={{ marginTop: 0 }}>
        <Link href="/dashboard/elections" style={{ color: '#2563eb' }}>
          ← Elections
        </Link>
      </p>
      <h1 style={{ marginTop: 0 }}>Verify your vote</h1>
      <p style={{ color: '#64748b', fontSize: '0.9rem' }}>
        Enter the verification token you received after casting your ballot. This confirms your vote
        was recorded without revealing how you voted.
      </p>
      <input
        value={token}
        onChange={(e) => setToken(e.target.value)}
        placeholder="Verification token"
        style={{
          width: '100%',
          padding: '0.6rem 0.75rem',
          borderRadius: 8,
          border: '1px solid #cbd5e1',
          marginBottom: 8,
        }}
      />
      <button
        type="button"
        disabled={pending || token.length < 8}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            setResult(null);
            const r = await verifyVoteTokenAction(token.trim());
            if (r.error) setError(r.error);
            else setResult(r.data as Record<string, unknown>);
          })
        }
        style={{
          padding: '0.5rem 1rem',
          borderRadius: 8,
          border: 'none',
          background: '#2563eb',
          color: '#fff',
          fontWeight: 600,
          cursor: 'pointer',
        }}
      >
        Verify
      </button>
      {error ? <p style={{ color: '#b91c1c' }}>{error}</p> : null}
      {result ? (
        <pre
          style={{
            marginTop: '1rem',
            padding: '1rem',
            background: '#f0fdf4',
            borderRadius: 8,
            fontSize: '0.85rem',
            overflow: 'auto',
          }}
        >
          {JSON.stringify(result, null, 2)}
        </pre>
      ) : null}
    </main>
  );
}
