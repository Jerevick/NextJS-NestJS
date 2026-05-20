import type { Metadata } from 'next';
import { Suspense } from 'react';
import { RegisterPage } from '@/components/auth/register-page';
import styles from '@/components/auth/auth.module.css';

export const metadata: Metadata = {
  title: 'Institution onboarding — UniCore',
  description:
    'Request enterprise platform access for your institution. Submit organization, compliance, and deployment details for UniCore tenant provisioning.',
};

export default function RegisterRoute() {
  return (
    <Suspense fallback={<RegisterFallback />}>
      <RegisterPage />
    </Suspense>
  );
}

function RegisterFallback() {
  return (
    <main className={styles.shell} style={{ placeItems: 'center', display: 'grid' }}>
      <p style={{ color: '#64748b' }}>Loading registration…</p>
    </main>
  );
}
