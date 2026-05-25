'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { FormEvent, useEffect, useState } from 'react';

const apiBase = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export default function ChangePasswordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session, status, update } = useSession();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const rawCallbackUrl = searchParams.get('callbackUrl');
  const callbackUrl = rawCallbackUrl?.startsWith('/') ? rawCallbackUrl : '/dashboard';

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace(`/login?callbackUrl=${encodeURIComponent('/change-password')}`);
    }
  }, [router, status]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (!session?.accessToken) {
      setError('Your session has expired. Sign in again.');
      return;
    }
    if (newPassword.length < 12) {
      setError('New password must be at least 12 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('New passwords do not match.');
      return;
    }

    setBusy(true);
    try {
      const res = await fetch(`${apiBase}/auth/password/change`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { message?: string | string[] } | null;
        const message = Array.isArray(body?.message) ? body.message.join(' ') : body?.message;
        throw new Error(message ?? 'Could not change password.');
      }
      await update({ forcePasswordChange: false });
      router.replace(callbackUrl);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not change password.');
    } finally {
      setBusy(false);
    }
  }

  if (status !== 'authenticated') {
    return null;
  }

  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        padding: '2rem',
        fontFamily: 'system-ui',
        background: '#f8fafc',
      }}
    >
      <form
        onSubmit={(event) => void onSubmit(event)}
        style={{
          width: 'min(100%, 520px)',
          border: '1px solid #e2e8f0',
          borderRadius: 18,
          background: '#fff',
          padding: '2rem',
          boxShadow: '0 24px 60px rgba(15, 23, 42, 0.08)',
          display: 'grid',
          gap: '1rem',
        }}
      >
        <div>
          <p style={{ margin: 0, color: '#64748b', fontSize: '0.9rem', fontWeight: 700 }}>
            Initial password change required
          </p>
          <h1 style={{ margin: '0.5rem 0 0', color: '#0f172a' }}>Create your permanent password</h1>
          <p style={{ color: '#475569', lineHeight: 1.6 }}>
            The temporary password sent during provisioning must be changed before normal system
            access continues.
          </p>
        </div>

        <label style={{ display: 'grid', gap: 6, color: '#334155', fontWeight: 600 }}>
          Temporary password
          <input
            type="password"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
            autoComplete="current-password"
            required
            style={{ padding: '0.75rem', borderRadius: 10, border: '1px solid #cbd5e1' }}
          />
        </label>
        <label style={{ display: 'grid', gap: 6, color: '#334155', fontWeight: 600 }}>
          New password
          <input
            type="password"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            autoComplete="new-password"
            minLength={12}
            required
            style={{ padding: '0.75rem', borderRadius: 10, border: '1px solid #cbd5e1' }}
          />
        </label>
        <label style={{ display: 'grid', gap: 6, color: '#334155', fontWeight: 600 }}>
          Confirm new password
          <input
            type="password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            autoComplete="new-password"
            minLength={12}
            required
            style={{ padding: '0.75rem', borderRadius: 10, border: '1px solid #cbd5e1' }}
          />
        </label>

        {error ? <p style={{ color: '#b91c1c', margin: 0 }}>{error}</p> : null}

        <button
          type="submit"
          disabled={busy}
          style={{
            border: 'none',
            borderRadius: 10,
            padding: '0.85rem 1rem',
            background: busy ? '#94a3b8' : '#2563eb',
            color: '#fff',
            fontWeight: 700,
            cursor: busy ? 'not-allowed' : 'pointer',
          }}
        >
          {busy ? 'Updating...' : 'Change password and continue'}
        </button>
      </form>
    </main>
  );
}
