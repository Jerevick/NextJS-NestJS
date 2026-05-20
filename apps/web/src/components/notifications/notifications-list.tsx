'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { markNotificationReadAction } from '@/app/notifications/actions';

type Row = {
  id: string;
  category: string;
  title: string;
  body: string;
  actionUrl: string | null;
  readAt: string | null;
  createdAt: string;
};

export function NotificationsList({ initial }: { initial: Row[] }) {
  const [rows, setRows] = useState(initial);
  const [pending, startTransition] = useTransition();

  if (rows.length === 0) {
    return <p style={{ color: '#94a3b8', marginTop: '1rem' }}>No notifications yet.</p>;
  }

  return (
    <ul style={{ listStyle: 'none', padding: 0, marginTop: '1.25rem', display: 'grid', gap: 10 }}>
      {rows.map((n) => (
        <li
          key={n.id}
          style={{
            padding: '0.85rem 1rem',
            borderRadius: 10,
            border: '1px solid #e2e8f0',
            background: n.readAt ? '#f8fafc' : '#fff',
            opacity: pending ? 0.85 : 1,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
            <div>
              <div style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase' }}>
                {n.category}
              </div>
              <strong style={{ display: 'block', color: '#0f172a' }}>{n.title}</strong>
              <p style={{ margin: '0.35rem 0 0', fontSize: '0.88rem', color: '#475569' }}>
                {n.body}
              </p>
              <time style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                {new Date(n.createdAt).toLocaleString()}
              </time>
            </div>
            <div
              style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}
            >
              {n.actionUrl ? (
                <Link
                  href={n.actionUrl}
                  style={{ fontSize: '0.82rem', color: '#0d9488' }}
                  onClick={() => {
                    if (!n.readAt) {
                      startTransition(async () => {
                        const r = await markNotificationReadAction(n.id);
                        if (r.ok) {
                          setRows((prev) =>
                            prev.map((row) =>
                              row.id === n.id ? { ...row, readAt: new Date().toISOString() } : row,
                            ),
                          );
                        }
                      });
                    }
                  }}
                >
                  Open
                </Link>
              ) : null}
              {!n.readAt ? (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => {
                    startTransition(async () => {
                      const r = await markNotificationReadAction(n.id);
                      if (r.ok) {
                        setRows((prev) =>
                          prev.map((row) =>
                            row.id === n.id ? { ...row, readAt: new Date().toISOString() } : row,
                          ),
                        );
                      }
                    });
                  }}
                  style={{
                    fontSize: '0.78rem',
                    border: '1px solid #cbd5e1',
                    background: '#fff',
                    borderRadius: 6,
                    padding: '0.2rem 0.5rem',
                    cursor: 'pointer',
                  }}
                >
                  Mark read
                </button>
              ) : null}
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
