'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';

export type StaffRegistryRow = {
  id: string;
  staffNumber: string;
  name: string;
  email: string;
  entity?: { id: string; code: string; name: string };
  position: { title: string };
  orgUnit: { name: string };
};

export function StaffRegistryTable({
  profiles,
  directoryScope = 'entity',
}: {
  profiles: StaffRegistryRow[];
  directoryScope?: 'entity' | 'institution';
}) {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return profiles;
    return profiles.filter(
      (p) =>
        p.staffNumber.toLowerCase().includes(q) ||
        p.name.toLowerCase().includes(q) ||
        p.email.toLowerCase().includes(q) ||
        p.position.title.toLowerCase().includes(q) ||
        p.orgUnit.name.toLowerCase().includes(q) ||
        (p.entity?.code ?? '').toLowerCase().includes(q),
    );
  }, [profiles, query]);

  return (
    <div>
      <input
        type="search"
        placeholder="Search by name, number, email, position…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        style={{
          width: '100%',
          maxWidth: 360,
          marginBottom: '0.75rem',
          padding: '0.45rem 0.65rem',
          borderRadius: 8,
          border: '1px solid #e2e8f0',
          fontSize: '0.85rem',
        }}
      />
      {filtered.length === 0 ? (
        <p style={{ margin: 0, color: '#64748b', fontSize: '0.9rem' }}>No matching staff.</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', fontSize: '0.85rem', borderCollapse: 'collapse' }}>
            <thead>
              <tr
                style={{ borderBottom: '1px solid #e2e8f0', color: '#64748b', textAlign: 'left' }}
              >
                <th style={{ padding: '0.4rem' }}>#</th>
                <th style={{ padding: '0.4rem' }}>Name</th>
                <th style={{ padding: '0.4rem' }}>Contact</th>
                <th style={{ padding: '0.4rem' }}>Entity</th>
                <th style={{ padding: '0.4rem' }}>Unit</th>
                <th style={{ padding: '0.4rem' }}>Position</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '0.4rem', fontFamily: 'monospace' }}>
                    <Link
                      href={
                        directoryScope === 'institution'
                          ? `/staff/${p.id}?scope=institution`
                          : `/staff/${p.id}`
                      }
                      style={{ color: '#2563eb' }}
                    >
                      {p.staffNumber}
                    </Link>
                  </td>
                  <td style={{ padding: '0.4rem' }}>{p.name}</td>
                  <td style={{ padding: '0.4rem', color: '#64748b' }}>{p.email}</td>
                  <td style={{ padding: '0.4rem' }} title={p.entity?.name}>
                    {p.entity?.code ?? '—'}
                  </td>
                  <td style={{ padding: '0.4rem' }}>{p.orgUnit.name}</td>
                  <td style={{ padding: '0.4rem' }}>{p.position.title}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p style={{ margin: '0.5rem 0 0', fontSize: '0.75rem', color: '#94a3b8' }}>
        Showing {filtered.length} of {profiles.length}
      </p>
    </div>
  );
}
