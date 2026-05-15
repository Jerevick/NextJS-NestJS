'use client';

import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useState } from 'react';

const apiBase = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export function EntitySuspendButton({
  entityId,
  entityCode,
  isMainCampus,
}: {
  entityId: string;
  entityCode: string;
  isMainCampus: boolean;
}) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (status !== 'authenticated' || !session?.accessToken || !session.user?.institutionId) {
    return null;
  }
  if (isMainCampus) {
    return (
      <p style={{ color: '#64748b', fontSize: '0.9rem', margin: 0 }}>
        The MAIN campus entity cannot be suspended (billing and auth depend on it).
      </p>
    );
  }

  async function onSuspend(): Promise<void> {
    const s = session;
    if (!s?.accessToken || !s.user?.institutionId) {
      return;
    }
    if (!window.confirm(`Suspend campus “${entityCode}”? Staff and students on this entity may lose access until reactivated.`)) {
      return;
    }
    setBusy(true);
    setMsg(null);
    const inst = s.user.institutionId;
    const res = await fetch(`${apiBase}/institutions/${inst}/entities/${entityId}/suspend`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${s.accessToken}`,
        'X-Institution-ID': inst,
      },
    });
    setBusy(false);
    if (!res.ok) {
      const t = await res.text();
      setMsg(t || `Request failed (${res.status})`);
      return;
    }
    router.refresh();
    setMsg('Campus suspended.');
  }

  return (
    <div>
      <button
        type="button"
        disabled={busy}
        onClick={() => void onSuspend()}
        style={{
          padding: '0.5rem 1rem',
          borderRadius: 8,
          border: '1px solid #b91c1c',
          background: '#fef2f2',
          color: '#991b1b',
          fontWeight: 600,
          cursor: busy ? 'wait' : 'pointer',
        }}
      >
        {busy ? 'Suspending…' : 'Suspend this campus'}
      </button>
      {msg ? (
        <p style={{ marginTop: '0.75rem', fontSize: '0.85rem', color: msg.startsWith('Campus') ? '#15803d' : '#b91c1c' }}>{msg}</p>
      ) : null}
    </div>
  );
}
