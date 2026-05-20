import type { Metadata } from 'next';
import { Suspense } from 'react';
import { LoginPage } from '@/components/auth/login-page';
import styles from '@/components/auth/auth.module.css';

export const metadata: Metadata = {
  title: 'Sign in — UniCore',
  description: 'Sign in to your UniCore institution workspace.',
};

export default function LoginRoute() {
  return (
    <Suspense fallback={<AuthFallback label="Loading sign in…" />}>
      <LoginPage />
    </Suspense>
  );
}

function AuthFallback({ label }: { label: string }) {
  return (
    <main className={styles.shell} style={{ placeItems: 'center', display: 'grid' }}>
      <p style={{ color: '#64748b' }}>{label}</p>
    </main>
  );
}
