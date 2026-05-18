'use client';

import { useState, useTransition } from 'react';
import {
  grantTeachingEntityAccessAction,
  revokeTeachingEntityAccessAction,
} from '@/app/staff/actions';

export function StaffEntityAccessPanel({
  profiles,
  entities,
  canWrite,
}: {
  profiles: Array<{ id: string; staffNumber: string; name: string }>;
  entities: Array<{ id: string; name: string; code: string }>;
  canWrite: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [access, setAccess] = useState<{
    teachingEntities: Array<{ id: string; name: string; code: string }>;
  } | null>(null);

  if (!canWrite) return null;

  return (
    <section
      style={{
        marginTop: '1.25rem',
        padding: '1.25rem 1.5rem',
        background: '#fff',
        border: '1px solid #e2e8f0',
        borderRadius: 12,
      }}
    >
      <h2 style={{ margin: '0 0 0.75rem', fontSize: '1.05rem', color: '#0f1729' }}>
        Cross-entity teaching access
      </h2>
      <p style={{ margin: '0 0 1rem', fontSize: '0.82rem', color: '#64748b' }}>
        Grant a staff member access to teach on another campus entity.
      </p>
      <form
        style={{ display: 'grid', gap: 8, maxWidth: 420 }}
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          const staffId = String(fd.get('staffId'));
          const entityId = String(fd.get('entityId'));
          startTransition(async () => {
            const r = await grantTeachingEntityAccessAction(staffId, entityId);
            if (r.error) setMessage(r.error);
            else {
              setAccess(r.data ?? null);
              setMessage('Teaching access granted.');
            }
          });
        }}
      >
        <select name="staffId" required style={inputStyle}>
          <option value="">Staff profile</option>
          {profiles.map((p) => (
            <option key={p.id} value={p.id}>
              {p.staffNumber} — {p.name}
            </option>
          ))}
        </select>
        <select name="entityId" required style={inputStyle}>
          <option value="">Campus entity</option>
          {entities.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name} ({e.code})
            </option>
          ))}
        </select>
        <button type="submit" disabled={pending} style={btnStyle}>
          Grant access
        </button>
      </form>
      {access?.teachingEntities?.length ? (
        <ul style={{ margin: '1rem 0 0', fontSize: '0.85rem', color: '#334155' }}>
          {access.teachingEntities.map((e) => (
            <li key={e.id} style={{ marginBottom: 6 }}>
              {e.name} ({e.code}){' '}
              <button
                type="button"
                disabled={pending}
                style={{ ...btnStyle, padding: '2px 8px', fontSize: '0.75rem', marginLeft: 8 }}
                onClick={() => {
                  const staffId = (
                    document.querySelector('select[name="staffId"]') as HTMLSelectElement
                  )?.value;
                  if (!staffId) return;
                  startTransition(async () => {
                    const r = await revokeTeachingEntityAccessAction(staffId, e.id);
                    setMessage(r.error ?? 'Access revoked.');
                    if (r.data) setAccess(r.data);
                  });
                }}
              >
                Revoke
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {message ? (
        <p style={{ margin: '0.75rem 0 0', fontSize: '0.85rem', color: '#64748b' }}>{message}</p>
      ) : null}
    </section>
  );
}

const inputStyle = {
  padding: '0.45rem 0.6rem',
  borderRadius: 8,
  border: '1px solid #e2e8f0',
  fontSize: '0.85rem',
} as const;

const btnStyle = {
  padding: '0.45rem 0.75rem',
  borderRadius: 8,
  border: 'none',
  background: '#1e3a5f',
  color: '#fff',
  fontWeight: 600,
  fontSize: '0.85rem',
  cursor: 'pointer',
} as const;
