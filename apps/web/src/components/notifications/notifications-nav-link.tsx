'use client';

import Link from 'next/link';
import type { CSSProperties } from 'react';
import { useNotificationsRealtime } from './notifications-realtime-provider';

export function NotificationsNavLink({
  href = '/notifications',
  style,
}: {
  href?: string;
  style?: CSSProperties;
}) {
  const rt = useNotificationsRealtime();
  const count = rt?.unreadCount;
  const live = rt?.live ?? false;

  return (
    <Link href={href} style={{ color: '#2563eb', position: 'relative', ...style }}>
      Notifications
      {typeof count === 'number' && count > 0 ? (
        <span
          style={{
            marginLeft: 6,
            fontSize: '0.72rem',
            fontWeight: 700,
            background: '#dc2626',
            color: '#fff',
            borderRadius: 999,
            padding: '0.1rem 0.45rem',
            verticalAlign: 'middle',
          }}
        >
          {count > 99 ? '99+' : count}
        </span>
      ) : null}
      {live ? (
        <span title="Live updates" style={{ marginLeft: 4, color: '#0d9488', fontSize: '0.65rem' }}>
          ●
        </span>
      ) : null}
    </Link>
  );
}
