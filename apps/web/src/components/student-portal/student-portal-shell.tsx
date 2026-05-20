'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { STUDENT_NAV, STUDENT_PORTAL } from './student-portal-styles';

export function StudentPortalShell({
  children,
  displayName,
  readOnly,
}: {
  children: ReactNode;
  displayName?: string;
  readOnly?: boolean;
}) {
  const pathname = usePathname();

  return (
    <div
      style={{
        display: 'flex',
        minHeight: '100vh',
        background: STUDENT_PORTAL.bg,
        fontFamily: 'var(--font-portal), ui-sans-serif, system-ui',
      }}
    >
      <aside
        style={{
          width: 240,
          flexShrink: 0,
          background: STUDENT_PORTAL.navy,
          color: '#e2e8f0',
          padding: '1.5rem 1rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
        }}
      >
        <div>
          <div style={{ fontWeight: 700, fontSize: '1.1rem', color: '#fff' }}>Student portal</div>
          {displayName ? (
            <div style={{ fontSize: '0.85rem', color: '#94a3b8', marginTop: 4 }}>{displayName}</div>
          ) : null}
        </div>
        {readOnly ? (
          <div
            style={{
              fontSize: '0.78rem',
              padding: '0.5rem 0.65rem',
              borderRadius: 8,
              background: 'rgba(251,191,36,0.15)',
              color: '#fcd34d',
              border: '1px solid rgba(251,191,36,0.35)',
            }}
          >
            Read-only — enrollment inactive
          </div>
        ) : null}
        <nav style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {STUDENT_NAV.map((item) => {
            const active =
              pathname === item.href ||
              (item.href !== '/dashboard' && pathname.startsWith(`${item.href}/`));
            return (
              <Link
                key={item.href}
                href={item.href}
                style={{
                  padding: '0.5rem 0.65rem',
                  borderRadius: 8,
                  textDecoration: 'none',
                  fontSize: '0.92rem',
                  fontWeight: active ? 600 : 500,
                  color: active ? STUDENT_PORTAL.teal : '#cbd5e1',
                  background: active ? 'rgba(13,148,136,0.15)' : 'transparent',
                }}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>
      <main style={{ flex: 1, minWidth: 0 }}>{children}</main>
    </div>
  );
}
