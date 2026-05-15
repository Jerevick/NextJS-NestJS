import Link from 'next/link';
import { auth } from '@/auth';
import { PermissionGate } from '@/components/permission-gate';

export default async function AdminPage() {
  const session = await auth();
  return (
    <main style={{ padding: '2rem', fontFamily: 'system-ui', maxWidth: 720 }}>
      <nav style={{ marginBottom: '1rem' }}>
        <Link href="/dashboard">← Dashboard</Link>
      </nav>
      <h1>Admin</h1>
      <p style={{ color: '#64748b' }}>Signed in as {session?.user?.email}</p>
      <PermissionGate permission="institutions.write" fallback={<p>You do not have admin permissions.</p>}>
        <p>Institution admin tools will live here (Phase 2+).</p>
      </PermissionGate>
    </main>
  );
}
