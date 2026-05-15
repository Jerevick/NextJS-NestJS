import Link from 'next/link';
import { auth } from '@/auth';
import { hasPermission } from '@/lib/permissions';
import { CreateStudentForm, type ProgramOption } from './create-student-form';

const apiBase = process.env.AUTH_API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export default async function NewStudentPage() {
  const session = await auth();
  const token = session?.accessToken;
  const canWrite = hasPermission(session?.user?.permissions, 'students.write');

  if (!token) {
    return (
      <main style={{ padding: '2rem', fontFamily: 'system-ui', maxWidth: 640 }}>
        <h1>New student</h1>
        <p style={{ color: '#64748b' }}>Sign in with credentials that include an API access token.</p>
        <Link href="/login">Sign in</Link>
      </main>
    );
  }

  if (!canWrite) {
    return (
      <main style={{ padding: '2rem', fontFamily: 'system-ui', maxWidth: 640 }}>
        <nav style={{ marginBottom: '1rem' }}>
          <Link href="/students">← Students</Link>
        </nav>
        <h1>New student</h1>
        <p style={{ color: '#64748b' }}>Your account does not have permission to create students.</p>
      </main>
    );
  }

  const catalog = await fetch(`${apiBase}/academic/catalog/programs`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });

  if (!catalog.ok) {
    const detail = await catalog.text();
    return (
      <main style={{ padding: '2rem', fontFamily: 'system-ui', maxWidth: 640 }}>
        <nav style={{ marginBottom: '1rem' }}>
          <Link href="/students">← Students</Link>
        </nav>
        <h1>New student</h1>
        <p style={{ color: '#b91c1c' }}>Could not load programs ({catalog.status}).</p>
        <pre style={{ fontSize: 12, overflow: 'auto' }}>{detail}</pre>
      </main>
    );
  }

  const programs = (await catalog.json()) as ProgramOption[];

  if (programs.length === 0) {
    return (
      <main style={{ padding: '2rem', fontFamily: 'system-ui', maxWidth: 640 }}>
        <nav style={{ marginBottom: '1rem' }}>
          <Link href="/students">← Students</Link>
        </nav>
        <h1>New student</h1>
        <p style={{ color: '#64748b' }}>
          No programs exist yet for this institution. Create academic structure (division → department → program) first.
        </p>
      </main>
    );
  }

  return (
    <main style={{ padding: '2rem', fontFamily: 'system-ui', maxWidth: 640 }}>
      <nav style={{ marginBottom: '1.5rem', display: 'flex', gap: '1rem' }}>
        <Link href="/students">← Students</Link>
        <Link href="/dashboard">Dashboard</Link>
      </nav>
      <h1 style={{ fontFamily: 'Georgia, serif', color: '#1e3a5f' }}>New student</h1>
      <p style={{ color: '#64748b', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
        Creates a user account and student record. Student number is assigned from institution settings.
      </p>
      <CreateStudentForm programs={programs} />
    </main>
  );
}
