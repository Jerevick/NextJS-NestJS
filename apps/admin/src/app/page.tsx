import type { Metadata } from 'next';
import Link from 'next/link';
import { env } from '@/env';

export const metadata: Metadata = {
  title: 'UniCore — Super Admin',
  description: 'Platform operations',
};

export default function AdminHome() {
  const hasBearer = Boolean(env.ADMIN_API_BEARER);
  return (
    <main style={{ padding: '2rem', maxWidth: 720 }}>
      <h1 style={{ fontSize: '1.25rem', fontWeight: 600, marginTop: 0 }}>Super admin</h1>
      <p style={{ color: '#94a3b8', lineHeight: 1.5 }}>
        Phase 2.2 shell: connect this app to the Nest API with a platform JWT. API base{' '}
        <code style={{ color: '#38bdf8' }}>{env.NEXT_PUBLIC_API_URL}</code>
        {hasBearer ? (
          <span style={{ color: '#4ade80' }}> · ADMIN_API_BEARER is set</span>
        ) : (
          <span style={{ color: '#fbbf24' }}> · ADMIN_API_BEARER not set (mock lists)</span>
        )}
        .
      </p>
      <ul style={{ color: '#cbd5e1', lineHeight: 1.8 }}>
        <li>
          <Link href="/dashboard" style={{ color: '#60a5fa' }}>
            Dashboard
          </Link>{' '}
          — KPI placeholders
        </li>
        <li>
          <Link href="/institutions" style={{ color: '#60a5fa' }}>
            Institutions
          </Link>{' '}
          — monitoring list + drill-down
        </li>
      </ul>
      <p style={{ color: '#64748b', fontSize: '0.85rem', marginTop: '2rem' }}>
        Full roadmap (LMS, finance, elections, …) lives in{' '}
        <code>UNICORE_MASTER_PROMPT.md</code> — ship those as separate milestones.
      </p>
    </main>
  );
}
