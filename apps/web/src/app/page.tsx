import Link from 'next/link';
import { BrandMark } from '@unicore/ui';
import { env } from '@/env';

export default function HomePage() {
  return (
    <main style={{ padding: '2rem', fontFamily: 'system-ui' }}>
      <BrandMark />
      <p style={{ marginTop: '1rem', color: '#334155' }}>
        Institution portal. API: {env.NEXT_PUBLIC_API_URL}
      </p>
      <p style={{ marginTop: '1rem' }}>
        <Link href="/login">Sign in</Link>
        {' · '}
        <Link href="/dashboard">Dashboard</Link>
      </p>
    </main>
  );
}
