import Link from 'next/link';
import { auth } from '@/auth';
import { PermissionGate } from '@/components/permission-gate';

export default async function AdminPage() {
  const session = await auth();
  const isSuperAdmin = session?.user?.permissions?.includes('*') ?? false;
  return (
    <main style={{ padding: '2rem', fontFamily: 'system-ui', maxWidth: 720 }}>
      <nav style={{ marginBottom: '1rem' }}>
        <Link href="/dashboard">← Institution overview</Link>
      </nav>
      <h1>Admin tools</h1>
      <p style={{ color: '#64748b' }}>
        Signed in as {session?.user?.email}. KPIs and headcount live on the{' '}
        <Link href="/dashboard">dashboard</Link>.
      </p>
      <PermissionGate
        permission="institutions.write"
        fallback={<p>You do not have admin permissions.</p>}
      >
        <ul style={{ lineHeight: 1.8 }}>
          <li>
            <Link href="/admin/ai-intelligence">Administrative AI intelligence</Link>
            <span style={{ color: '#64748b' }}> — narratives, billing anomalies, dropout risk</span>
          </li>
          {isSuperAdmin ? (
            <li>
              <Link href="/admin/registration-requests">Institution onboarding requests</Link>
              <span style={{ color: '#64748b' }}>
                {' '}
                — review public registration submissions, approve or dismiss
              </span>
            </li>
          ) : null}
        </ul>
      </PermissionGate>
    </main>
  );
}
