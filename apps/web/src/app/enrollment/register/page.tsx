import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';

const primary = '#1e3a5f';

export default async function EnrollmentRegisterPage() {
  const session = await auth();

  if (!session?.accessToken) {
    return (
      <main style={{ padding: '2rem', fontFamily: 'var(--font-sans), system-ui' }}>
        <h1 style={{ color: primary, fontFamily: 'var(--font-serif), Georgia, serif' }}>
          Course enrollment
        </h1>
        <p>You need to sign in to enroll in sections.</p>
        <Link href="/login">Sign in</Link>
      </main>
    );
  }

  if (!session.user.studentId) {
    return (
      <main style={{ padding: '2rem', fontFamily: 'var(--font-sans), system-ui' }}>
        <h1 style={{ color: primary, fontFamily: 'var(--font-serif), Georgia, serif' }}>
          Course enrollment
        </h1>
        <p>This path is reserved for student accounts linked to an active student record.</p>
        <Link href="/dashboard">Dashboard</Link>
      </main>
    );
  }

  redirect('/register-courses');
}
