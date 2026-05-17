import Link from 'next/link';
import { AttendanceSelfCheckInForm } from './self-check-in-form';

const primary = '#1e3a5f';

export default function AttendanceSelfCheckInPage() {
  return (
    <main
      style={{
        padding: '2rem 1.5rem',
        maxWidth: 640,
        margin: '0 auto',
        fontFamily: 'var(--font-sans), system-ui',
      }}
    >
      <nav style={{ marginBottom: '1rem' }}>
        <Link href="/dashboard" style={{ color: primary, textDecoration: 'none' }}>
          ← Dashboard
        </Link>
      </nav>
      <h1 style={{ fontFamily: 'var(--font-serif), Georgia, serif', color: primary }}>
        Attendance check-in
      </h1>
      <AttendanceSelfCheckInForm />
    </main>
  );
}
