import Link from 'next/link';
import { auth } from '@/auth';
import { AlumniHub } from '@/components/alumni/alumni-hub';
import { appendOptionalEntityHeader } from '@/lib/api-headers';
import { hasPermission } from '@/lib/permissions';

const apiBase =
  process.env.AUTH_API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export default async function AlumniPage() {
  const session = await auth();
  const canRead = hasPermission(session?.user?.permissions, 'alumni.read');
  const canWrite = hasPermission(session?.user?.permissions, 'alumni.write');

  if (!session?.accessToken) {
    return (
      <main style={{ padding: '2rem' }}>
        <p style={{ color: '#64748b' }}>Sign in to access alumni.</p>
      </main>
    );
  }

  if (!canRead) {
    return (
      <main style={{ padding: '2rem', maxWidth: 720 }}>
        <h1 style={{ color: '#0f1729' }}>Alumni</h1>
        <p style={{ color: '#64748b' }}>You need alumni.read permission.</p>
      </main>
    );
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${session.accessToken}`,
    'X-Institution-ID': session.user.institutionId,
  };
  appendOptionalEntityHeader(headers, session.user);

  const [dirRes, eventsRes, jobsRes, campaignsRes] = await Promise.all([
    fetch(`${apiBase}/alumni/directory`, { headers, cache: 'no-store' }),
    fetch(`${apiBase}/alumni/events`, { headers, cache: 'no-store' }),
    fetch(`${apiBase}/alumni/jobs`, { headers, cache: 'no-store' }),
    fetch(`${apiBase}/alumni/campaigns`, { headers, cache: 'no-store' }),
  ]);

  const directory = dirRes.ok ? await dirRes.json() : [];
  const events = eventsRes.ok ? await eventsRes.json() : [];
  const jobs = jobsRes.ok ? await jobsRes.json() : [];
  const campaigns = campaignsRes.ok ? await campaignsRes.json() : [];

  return (
    <main style={{ padding: '2rem', maxWidth: 960, margin: '0 auto' }}>
      <p style={{ margin: '0 0 0.5rem' }}>
        <Link href="/dashboard" style={{ color: '#2563eb' }}>
          Dashboard
        </Link>
      </p>
      <h1 style={{ margin: '0 0 1rem', color: '#0f1729' }}>Alumni</h1>
      <AlumniHub
        directory={Array.isArray(directory) ? directory : []}
        events={Array.isArray(events) ? events : []}
        jobs={Array.isArray(jobs) ? jobs : []}
        campaigns={Array.isArray(campaigns) ? campaigns : []}
        canWrite={canWrite}
      />
    </main>
  );
}
