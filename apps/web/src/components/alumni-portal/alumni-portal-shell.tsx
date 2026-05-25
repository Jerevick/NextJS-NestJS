import Link from 'next/link';
import type { ReactNode } from 'react';

export function AlumniPortalShell({
  displayName,
  children,
}: {
  displayName: string;
  children: ReactNode;
}) {
  return (
    <section style={{ minHeight: '100vh', background: '#f8fafc', fontFamily: 'system-ui' }}>
      <header
        style={{
          background: '#0f1729',
          color: '#fff',
          padding: '0.85rem 2rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
          flexWrap: 'wrap',
        }}
      >
        <Link
          href="/dashboard/alumni/home"
          style={{ color: '#fff', textDecoration: 'none', fontWeight: 700 }}
        >
          Alumni portal
        </Link>
        <nav style={{ display: 'flex', gap: '1.25rem', fontSize: '0.9rem', flexWrap: 'wrap' }}>
          <Link href="/dashboard/alumni/home" style={{ color: '#a5f3fc' }}>
            Home
          </Link>
          <Link href="/dashboard/alumni/events" style={{ color: '#a5f3fc' }}>
            Events
          </Link>
          <Link href="/dashboard/alumni/jobs" style={{ color: '#a5f3fc' }}>
            Jobs
          </Link>
          <Link href="/dashboard/alumni/profile" style={{ color: '#a5f3fc' }}>
            Profile
          </Link>
          <Link href="/dashboard/notifications" style={{ color: '#a5f3fc' }}>
            Notifications
          </Link>
        </nav>
        <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>{displayName}</span>
      </header>
      <section style={{ padding: '1.5rem 2rem' }}>{children}</section>
    </section>
  );
}
