import Link from 'next/link';

export default function ForgotPasswordPage() {
  return (
    <main style={{ maxWidth: 480, margin: '4rem auto', fontFamily: 'system-ui', padding: '0 1rem' }}>
      <h1 style={{ fontSize: '1.5rem' }}>Forgot password</h1>
      <p style={{ color: '#64748b' }}>
        Password reset via email is not wired yet (requires mail provider + BullMQ per Phase 1 spec).
        Contact your institution administrator for access.
      </p>
      <p>
        <Link href="/login">Back to sign in</Link>
      </p>
    </main>
  );
}
