import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { CreateEntityWizard } from '@/components/entities/create-entity-wizard';

export default async function NewEntityPage() {
  const session = await auth();
  if (!session?.accessToken) {
    redirect('/login');
  }
  const perms = session.user.permissions ?? [];
  const canCreate =
    session.user.entityScope === 'ALL' && (perms.includes('*') || perms.includes('institutions.write'));
  if (!canCreate) {
    return (
      <main style={{ padding: '2rem', fontFamily: 'system-ui', maxWidth: 640 }}>
        <h1>Add campus</h1>
        <p style={{ color: '#64748b' }}>
          You need <strong>entityScope ALL</strong> and the <strong>institutions.write</strong> permission to create
          campuses.
        </p>
        <Link href="/entities" style={{ color: '#2563eb' }}>
          Back to entities
        </Link>
      </main>
    );
  }

  return (
    <main style={{ padding: '2rem', fontFamily: 'system-ui', maxWidth: 720 }}>
      <h1 style={{ marginTop: 0 }}>Add campus</h1>
      <p style={{ color: '#64748b', fontSize: '0.95rem' }}>
        After creation, the app waits for provisioning (BullMQ) until the campus is ACTIVE.
      </p>
      <CreateEntityWizard />
    </main>
  );
}
