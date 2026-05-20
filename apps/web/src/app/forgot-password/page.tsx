import type { Metadata } from 'next';
import { Suspense } from 'react';
import { ForgotPasswordPage } from '@/components/auth/forgot-password-page';
import styles from '@/components/auth/auth.module.css';

export const metadata: Metadata = {
  title: 'Forgot password — UniCore',
  description: 'Reset your UniCore account password.',
};

export default function ForgotPasswordRoute() {
  return (
    <Suspense fallback={<AuthFallback label="Loading…" />}>
      <ForgotPasswordPage />
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
