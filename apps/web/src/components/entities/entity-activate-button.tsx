'use client';

import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useState } from 'react';

const apiBase = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export function EntityActivateButton({
  entityId,
  entityCode,
  status,
}: {
  entityId: string;
  entityCode: string;
  status: string;
}) {
  const { data: session, status: sessionStatus } = useSession();
  const router = useRouter();
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (sessionStatus !== 'authenticated' || !session?.accessToken || !session.user?.institutionId) {
    return null;
  }

  const canActivate = status === 'SUSPENDED' || status === 'PROVISIONING';
  if (!canActivate) {
    return null;
  }

  async function onActivate(): Promise<void> {
    const s = session;
    if (!s?.accessToken || !s.user?.institutionId) {
      return;
    }
    const label = status === 'PROVISIONING' ? 'finish provisioning for' : 'reactivate';
    if (!window.confirm(`${label.charAt(0).toUpperCase()}${label.slice(1)} campus “${entityCode}”?`)) {
      return;
    }
    setBusy(true);
    setMsg(null);
    const inst = s.user.institutionId;
    const res = await fetch(`${apiBase}/institutions/${inst}/entities/${entityId}/activate`, {
      method: 'POST',
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
    setMsg('Campus is now ACTIVE.');
  }

  return (
    <div>
      <button
        type="button"
        disabled={busy}
        onClick={() => void onActivate()}
        style={{
          padding: '0.5rem 1rem',
          borderRadius: 8,
          border: 'none',
          background: '#16a34a',
          color: '#fff',
          fontWeight: 600,
          cursor: busy ? 'wait' : 'pointer',
        }}
      >
        {busy ? 'Activating…' : status === 'PROVISIONING' ? 'Finish provisioning' : 'Reactivate campus'}
      </button>
      {msg ? (
        <p style={{ marginTop: '0.75rem', fontSize: '0.85rem', color: msg.includes('ACTIVE') ? '#15803d' : '#b91c1c' }}>
          {msg}
        </p>
      ) : null}
    </div>
  );
}
