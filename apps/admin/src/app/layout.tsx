import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { BrandMark } from '@unicore/ui';
import { Providers } from '@/components/providers';

export const metadata: Metadata = {
  title: 'UniCore — Super Admin',
  description: 'Platform operations',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          background: '#0a0a0a',
          color: '#e2e8f0',
          fontFamily: 'ui-sans-serif, system-ui, sans-serif',
        }}
      >
        <header
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '1.5rem',
            padding: '1rem 1.5rem',
            borderBottom: '1px solid #1e293b',
          }}
        >
          <Link href="/" style={{ color: '#2563eb', textDecoration: 'none' }}>
            <BrandMark title="UniCore Admin" />
          </Link>
          <nav style={{ display: 'flex', gap: '1rem', fontSize: '0.9rem' }}>
            <Link href="/dashboard" style={{ color: '#94a3b8' }}>
              Dashboard
            </Link>
            <Link href="/institutions" style={{ color: '#94a3b8' }}>
              Institutions
            </Link>
            <Link href="/billing" style={{ color: '#94a3b8' }}>
              Billing
            </Link>
            <Link href="/institutions/new" style={{ color: '#94a3b8' }}>
              Onboard
            </Link>
          </nav>
        </header>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
