'use client';

import { useEffect, useState, useTransition } from 'react';
import { searchUsersForStaffAction } from '@/app/staff/actions';

export function StaffUserPicker({
  name,
  required,
  onSelect,
}: {
  name: string;
  required?: boolean;
  onSelect?: (user: { id: string; email: string; name: string }) => void;
}) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<Array<{ id: string; email: string; name: string }>>([]);
  const [selectedId, setSelectedId] = useState('');
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (q.trim().length < 2) {
      setResults([]);
      return;
    }
    const t = setTimeout(() => {
      startTransition(async () => {
        const r = await searchUsersForStaffAction(q.trim());
        setResults(r.data ?? []);
      });
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <div>
      <input type="hidden" name={name} value={selectedId} required={required} />
      <input
        placeholder="Search user by email…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        style={inputStyle}
      />
      {pending ? <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Searching…</span> : null}
      {results.length > 0 ? (
        <ul
          style={{
            margin: '4px 0 0',
            padding: 0,
            listStyle: 'none',
            maxHeight: 120,
            overflow: 'auto',
            border: '1px solid #e2e8f0',
            borderRadius: 8,
          }}
        >
          {results.map((u) => (
            <li key={u.id}>
              <button
                type="button"
                onClick={() => {
                  setSelectedId(u.id);
                  setQ(`${u.name} <${u.email}>`);
                  setResults([]);
                  onSelect?.(u);
                }}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  padding: '0.4rem 0.6rem',
                  border: 'none',
                  background: selectedId === u.id ? '#eff6ff' : '#fff',
                  fontSize: '0.8rem',
                  cursor: 'pointer',
                }}
              >
                {u.name} · {u.email}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

const inputStyle = {
  padding: '0.45rem 0.6rem',
  borderRadius: 8,
  border: '1px solid #e2e8f0',
  fontSize: '0.85rem',
  width: '100%',
} as const;
