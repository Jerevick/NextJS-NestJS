import Link from 'next/link';
import { env } from '@/env';
import { ProvisionInstitutionForm } from './provision-form';

export default function NewInstitutionPage() {
  return (
    <main style={{ padding: '2rem', maxWidth: 560 }}>
      <p style={{ marginTop: 0 }}>
        <Link href="/institutions" style={{ color: '#60a5fa' }}>
          ← Institutions
        </Link>
      </p>
      <h1 style={{ fontSize: '1.25rem', marginTop: 0 }}>Onboard institution</h1>
      <p style={{ color: '#94a3b8', fontSize: '0.9rem' }}>
        Creates the tenant, MAIN_CAMPUS entity (provisioned), subscription, and institution admin user.
      </p>
      <ProvisionInstitutionForm bearerConfigured={Boolean(env.ADMIN_API_BEARER)} />
    </main>
  );
}
