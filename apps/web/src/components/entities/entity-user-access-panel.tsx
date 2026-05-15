'use client';

import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useState } from 'react';

const apiBase = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export function EntityUserAccessPanel({
  institutionId,
  entityId,
  initialRows,
}: {
  institutionId: string;
  entityId: string;
  initialRows: Array<{ id: string; userId: string; user: { email: string; role: string } }>;
}) {
  const { data: session } = useSession();
  const router = useRouter();
  const [userId, setUserId] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function buildHeaders(): Record<string, string> | null {
    if (!session?.accessToken) {
      return null;
    }
    const h: Record<string, string> = {
      Authorization: `Bearer ${session.accessToken}`,
      'Content-Type': 'application/json',
      'X-Institution-ID': institutionId,
    };
    if (session.user.entityId && !session.user.omitEntityHeader) {
      h['X-Entity-ID'] = session.user.entityId;
    }
    return h;
  }

  async function grant(): Promise<void> {
    setBusy(true);
    setMessage(null);
    const h = buildHeaders();
    if (!h) {
      setMessage('Not signed in.');
      setBusy(false);
      return;
    }
    const res = await fetch(`${apiBase}/institutions/${institutionId}/entities/${entityId}/user-access`, {
      method: 'POST',
      headers: h,
      body: JSON.stringify({ userId: userId.trim() }),
    });
    setBusy(false);
    if (!res.ok) {
      setMessage(`Grant failed (${res.status})`);
      return;
    }
    setUserId('');
    setMessage('Access granted.');
    router.refresh();
  }

  async function revoke(targetUserId: string): Promise<void> {
    setBusy(true);
    setMessage(null);
    const h = buildHeaders();
    if (!h) {
      setBusy(false);
      return;
    }
    const res = await fetch(
      `${apiBase}/institutions/${institutionId}/entities/${entityId}/user-access/${targetUserId}`,
      { method: 'DELETE', headers: h },
    );
    setBusy(false);
    if (!res.ok) {
      setMessage(`Revoke failed (${res.status})`);
      return;
    }
    setMessage('Access revoked.');
    router.refresh();
  }

  return (
    <section style={{ marginTop: '1rem' }}>
      <h3 style={{ fontSize: '0.95rem', margin: '0 0 0.5rem' }}>Cross-campus staff access</h3>
      <p style={{ color: '#64748b', fontSize: '0.85rem', margin: '0 0 0.75rem' }}>
        Grant lecturers or staff access to this campus without changing their home JWT scope.
      </p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <input
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
          placeholder="User id (cuid)"
          style={{ flex: 1, padding: '0.45rem 0.6rem', borderRadius: 8, border: '1px solid #cbd5e1' }}
        />
        <button
          type="button"
          disabled={busy || !userId.trim()}
          onClick={() => void grant()}
          style={{
            padding: '0.45rem 0.9rem',
            borderRadius: 8,
            border: 'none',
            background: '#2563eb',
            color: '#fff',
            fontWeight: 600,
            cursor: busy ? 'wait' : 'pointer',
          }}
        >
          Grant
        </button>
      </div>
      {message ? <p style={{ fontSize: '0.85rem', marginTop: '0.5rem' }}>{message}</p> : null}
      <ul style={{ listStyle: 'none', padding: 0, marginTop: '1rem' }}>
        {initialRows.map((r) => (
          <li
            key={r.id}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '0.5rem 0',
              borderBottom: '1px solid #e2e8f0',
              fontSize: '0.88rem',
            }}
          >
            <span>
              {r.user.email} <span style={{ color: '#94a3b8' }}>({r.user.role})</span>
            </span>
            <button
              type="button"
              disabled={busy}
              onClick={() => void revoke(r.userId)}
              style={{ fontSize: '0.8rem', color: '#b91c1c', background: 'none', border: 'none', cursor: 'pointer' }}
            >
              Revoke
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
