import Link from 'next/link';
import { RegistrationRequestDetail } from '@/components/registration-request-detail';
import { env } from '@/env';
import { getRegistrationRequest } from '@/lib/platform-api';
import type { RegistrationRequestRow } from '@/lib/registration-request.util';

export default async function RegistrationRequestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  if (!env.ADMIN_API_BEARER) {
    return (
      <main style={{ padding: '2rem' }}>
        <p style={{ color: '#fbbf24' }}>Set ADMIN_API_BEARER to load registration requests.</p>
      </main>
    );
  }

  const res = await getRegistrationRequest(id);
  if (res.mode !== 'live' || !res.found) {
    return (
      <main style={{ padding: '2rem' }}>
        <Link href="/registration-requests" style={{ color: '#60a5fa' }}>
          ← Registration requests
        </Link>
        <p style={{ color: '#94a3b8', marginTop: '1rem' }}>Request not found.</p>
      </main>
    );
  }

  const row = res.request as RegistrationRequestRow;

  return (
    <main style={{ padding: '2rem', maxWidth: 1100 }}>
      <p style={{ marginTop: 0 }}>
        <Link href="/registration-requests" style={{ color: '#60a5fa' }}>
          ← Registration requests
        </Link>
      </p>
      <RegistrationRequestDetail row={row} />
    </main>
  );
}
