'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { GUARDIAN_PORTAL } from './guardian-portal-styles';

export function GuardianPortalShell({ children, email }: { children: ReactNode; email?: string }) {
  const pathname = usePathname();
  const onDashboard =
    pathname === '/dashboard/guardian/dashboard' ||
    pathname.startsWith('/dashboard/guardian/dashboard/');

  return (
    <div
      style={{
        minHeight: '100vh',
        background: GUARDIAN_PORTAL.bg,
        fontFamily: 'var(--font-portal), ui-sans-serif, system-ui',
        fontSize: '1.05rem',
        lineHeight: 1.55,
      }}
    >
      <header
        style={{
          background: '#fff',
          borderBottom: `1px solid ${GUARDIAN_PORTAL.border}`,
          padding: '1rem 1.25rem',
        }}
      >
        <div style={{ maxWidth: 880, margin: '0 auto' }}>
          <div style={{ fontWeight: 700, fontSize: '1.25rem', color: GUARDIAN_PORTAL.text }}>
            Guardian portal
          </div>
          {email ? (
            <div style={{ color: GUARDIAN_PORTAL.muted, fontSize: '0.95rem', marginTop: 4 }}>
              Signed in as {email}
            </div>
          ) : null}
          <nav style={{ marginTop: '0.75rem' }}>
            <Link
              href="/dashboard/guardian/dashboard"
              style={{
                color: onDashboard ? GUARDIAN_PORTAL.accent : GUARDIAN_PORTAL.muted,
                fontWeight: 600,
                textDecoration: 'none',
                fontSize: '1rem',
              }}
            >
              My students
            </Link>
          </nav>
        </div>
      </header>
      <div style={{ maxWidth: 880, margin: '0 auto', padding: '1.25rem' }}>{children}</div>
    </div>
  );
}
