import Link from 'next/link';
import { AttendanceSessionQrForm } from './attendance-session-qr-form';

const primary = '#1e3a5f';

export default function TeachAttendanceQrPage() {
  return (
    <main
      style={{
        padding: '2rem 1.5rem',
        maxWidth: 720,
        margin: '0 auto',
        fontFamily: 'var(--font-sans), system-ui',
      }}
    >
      <nav style={{ marginBottom: '1rem' }}>
        <Link href="/teach" style={{ color: primary, textDecoration: 'none' }}>
          ← Teaching
        </Link>
      </nav>
      <h1 style={{ fontFamily: 'var(--font-serif), Georgia, serif', color: primary }}>
        Attendance session QR
      </h1>
      <AttendanceSessionQrForm />
    </main>
  );
}
