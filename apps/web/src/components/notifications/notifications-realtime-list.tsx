'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState, useTransition } from 'react';
import { markNotificationReadAction } from '@/app/notifications/actions';
import {
  useNotificationsRealtime,
  type RealtimeNotificationPayload,
} from './notifications-realtime-provider';

export type NotificationRow = {
  id: string;
  category: string;
  title: string;
  body: string;
  actionUrl: string | null;
  readAt: string | null;
  createdAt: string;
};

function NotificationRowItem({
  n,
  pending,
  onMarkRead,
}: {
  n: NotificationRow;
  pending: boolean;
  onMarkRead: (id: string) => void;
}) {
  const [, startTransition] = useTransition();

  return (
    <li
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
          <p style={{ margin: '0.35rem 0 0', fontSize: '0.88rem', color: '#475569' }}>{n.body}</p>
          <time style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
            {new Date(n.createdAt).toLocaleString()}
          </time>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
          {n.actionUrl ? (
            <Link
              href={n.actionUrl}
              style={{ fontSize: '0.82rem', color: '#0d9488' }}
              onClick={() => {
                if (!n.readAt) {
                  startTransition(() => onMarkRead(n.id));
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
              onClick={() => startTransition(() => onMarkRead(n.id))}
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
  );
}

function payloadToRow(payload: RealtimeNotificationPayload): NotificationRow {
  return {
    id: payload.id,
    category: payload.event ?? 'notification',
    title: payload.title,
    body: payload.body,
    actionUrl: payload.actionUrl ?? null,
    readAt: null,
    createdAt: payload.createdAt,
  };
}

export function NotificationsRealtimeList({
  initial,
  initialUnreadCount,
}: {
  initial: NotificationRow[];
  initialUnreadCount: number;
  accessToken?: string;
  apiBase?: string;
}) {
  const rt = useNotificationsRealtime();
  const [rows, setRows] = useState(initial);
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    rt?.setUnreadCount(initialUnreadCount);
  }, [initialUnreadCount, rt]);

  const markRead = useCallback(
    (id: string) => {
      startTransition(async () => {
        const r = await markNotificationReadAction(id);
        if (r.ok) {
          setRows((prev) =>
            prev.map((row) => (row.id === id ? { ...row, readAt: new Date().toISOString() } : row)),
          );
          setUnreadCount((c) => {
            const next = Math.max(0, c - 1);
            rt?.setUnreadCount(next);
            return next;
          });
        }
      });
    },
    [rt],
  );

  const prependNotification = useCallback((payload: RealtimeNotificationPayload) => {
    const row = payloadToRow(payload);
    setRows((prev) => (prev.some((r) => r.id === row.id) ? prev : [row, ...prev]));
  }, []);

  useEffect(() => {
    if (!rt) return;
    return rt.subscribe(prependNotification);
  }, [rt, prependNotification]);

  const live = rt?.live ?? false;
  const displayUnread = rt?.unreadCount ?? unreadCount;

  const statusLine = (
    <p style={{ color: '#64748b', fontSize: '0.9rem', margin: '0.25rem 0 0' }}>
      {displayUnread} unread
      {live ? (
        <span style={{ marginLeft: 8, color: '#0d9488', fontSize: '0.8rem' }}>● Live</span>
      ) : (
        <span style={{ marginLeft: 8, color: '#94a3b8', fontSize: '0.8rem' }}>○ Offline</span>
      )}
    </p>
  );

  if (rows.length === 0) {
    return (
      <div style={{ marginTop: '1rem' }}>
        {statusLine}
        <p style={{ color: '#94a3b8' }}>No notifications yet.</p>
        {live ? (
          <p style={{ color: '#64748b', fontSize: '0.8rem' }}>Listening for new notifications…</p>
        ) : null}
      </div>
    );
  }

  return (
    <>
      {statusLine}
      <ul style={{ listStyle: 'none', padding: 0, marginTop: '1.25rem', display: 'grid', gap: 10 }}>
        {rows.map((n) => (
          <NotificationRowItem key={n.id} n={n} pending={pending} onMarkRead={markRead} />
        ))}
      </ul>
    </>
  );
}
