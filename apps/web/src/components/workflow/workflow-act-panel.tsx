'use client';

import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useState } from 'react';

const apiBase = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export function WorkflowActPanel({
  instanceId,
  canAct,
}: {
  instanceId: string;
  canAct: boolean;
}) {
  const { data: session } = useSession();
  const router = useRouter();
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function act(action: 'APPROVE' | 'REJECT' | 'REQUEST_INFO' | 'ESCALATE'): Promise<void> {
    if (!session?.accessToken) {
      return;
    }
    setBusy(true);
    setMessage(null);
    const res = await fetch(`${apiBase}/workflow/instances/${instanceId}/act`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.accessToken}`,
        'Content-Type': 'application/json',
        'X-Institution-ID': session.user.institutionId,
      },
      body: JSON.stringify({ action, notes: notes.trim() || undefined }),
    });
    setBusy(false);
    if (!res.ok) {
      setMessage(`Action failed (${res.status})`);
      return;
    }
    setMessage(`Recorded: ${action}`);
    router.refresh();
  }

  if (!canAct) {
    return <p style={{ color: '#64748b', fontSize: '0.88rem' }}>You are not the current step assignee.</p>;
  }

  return (
    <div>
      <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: 4 }}>
        Notes (required for reject)
      </label>
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        rows={3}
        style={{ width: '100%', padding: '0.5rem', borderRadius: 8, border: '1px solid #cbd5e1' }}
      />
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
        <button type="button" disabled={busy} onClick={() => void act('APPROVE')} style={btnStyle('#16a34a')}>
          Approve
        </button>
        <button type="button" disabled={busy} onClick={() => void act('REJECT')} style={btnStyle('#b91c1c')}>
          Reject
        </button>
        <button type="button" disabled={busy} onClick={() => void act('REQUEST_INFO')} style={btnStyle('#64748b')}>
          Request info
        </button>
        <button type="button" disabled={busy} onClick={() => void act('ESCALATE')} style={btnStyle('#d97706')}>
          Escalate
        </button>
      </div>
      {message ? <p style={{ marginTop: 8, fontSize: '0.85rem' }}>{message}</p> : null}
    </div>
  );
}

function btnStyle(bg: string): React.CSSProperties {
  return {
    padding: '0.45rem 0.85rem',
    borderRadius: 8,
    border: 'none',
    background: bg,
    color: '#fff',
    fontWeight: 600,
    cursor: 'pointer',
  };
}
