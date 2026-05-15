'use client';

import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useState } from 'react';
import type { ParsedEntitySettings } from '@/lib/entity-settings';

const apiBase = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export function EntitySettingsForm({
  institutionId,
  entityId,
  initialName,
  settings,
  canEdit,
}: {
  institutionId: string;
  entityId: string;
  initialName: string;
  settings: ParsedEntitySettings;
  canEdit: boolean;
}) {
  const { data: session } = useSession();
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [shortName, setShortName] = useState(settings.shortName ?? '');
  const [description, setDescription] = useState(settings.description ?? '');
  const [location, setLocation] = useState(settings.location ?? '');
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSave(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    if (!canEdit || !session?.accessToken) {
      return;
    }
    setBusy(true);
    setMessage(null);
    const headers: Record<string, string> = {
      Authorization: `Bearer ${session.accessToken}`,
      'Content-Type': 'application/json',
      'X-Institution-ID': institutionId,
    };
    if (session.user.entityId && !session.user.omitEntityHeader) {
      headers['X-Entity-ID'] = session.user.entityId;
    }
    const res = await fetch(`${apiBase}/institutions/${institutionId}/entities/${entityId}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({
        name: name.trim(),
        shortName: shortName.trim() || undefined,
        description: description.trim() || undefined,
        location: location.trim() || undefined,
      }),
    });
    setBusy(false);
    if (!res.ok) {
      setMessage(`Save failed (${res.status})`);
      return;
    }
    setMessage('Settings saved.');
    router.refresh();
  }

  const inputStyle = { padding: '0.5rem 0.6rem', borderRadius: 8, border: '1px solid #cbd5e1', width: '100%' };

  return (
    <form onSubmit={(e) => void onSave(e)} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxWidth: 480 }}>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Display name</span>
        <input value={name} onChange={(e) => setName(e.target.value)} disabled={!canEdit || busy} style={inputStyle} />
      </label>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Short name</span>
        <input value={shortName} onChange={(e) => setShortName(e.target.value)} disabled={!canEdit || busy} style={inputStyle} />
      </label>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Location</span>
        <input value={location} onChange={(e) => setLocation(e.target.value)} disabled={!canEdit || busy} style={inputStyle} />
      </label>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Description</span>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          disabled={!canEdit || busy}
          rows={3}
          style={{ ...inputStyle, resize: 'vertical' }}
        />
      </label>
      {canEdit ? (
        <button
          type="submit"
          disabled={busy || !name.trim()}
          style={{
            alignSelf: 'flex-start',
            padding: '0.5rem 1rem',
            borderRadius: 8,
            border: 'none',
            background: '#2563eb',
            color: '#fff',
            fontWeight: 600,
            cursor: busy ? 'wait' : 'pointer',
          }}
        >
          {busy ? 'Saving…' : 'Save settings'}
        </button>
      ) : (
        <p style={{ color: '#64748b', fontSize: '0.88rem', margin: 0 }}>
          You need <strong>institutions.write</strong> and institution-wide scope to edit campus metadata.
        </p>
      )}
      {message ? <p style={{ fontSize: '0.85rem', margin: 0 }}>{message}</p> : null}
    </form>
  );
}
