import Link from 'next/link';

export default function RegisterPage() {
  return (
    <main style={{ maxWidth: 480, margin: '4rem auto', fontFamily: 'system-ui', padding: '0 1rem' }}>
      <h1 style={{ fontSize: '1.5rem' }}>Create an account</h1>
      <p style={{ color: '#64748b' }}>
        Self-service registration is not enabled in this build. Administrators provision users and
        send invitations from the institution console (Phase 1.2 placeholder).
      </p>
      <p>
        <Link href="/login">Back to sign in</Link>
      </p>
    </main>
  );
}
