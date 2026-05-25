import Link from 'next/link';

export default function TeachIndexPage() {
  return (
    <main style={{ padding: '2rem', maxWidth: 640, fontFamily: 'system-ui' }}>
      <nav style={{ marginBottom: '1rem' }}>
        <Link href="/dashboard/courses">← Courses</Link>
      </nav>
      <h1 style={{ color: '#0f1729' }}>Teach</h1>
      <p style={{ color: '#64748b' }}>
        Faculty course builder UI is not wired yet. Use the REST API under <code>/lms</code> with{' '}
        <strong>lms.write</strong>. From <Link href="/dashboard/courses">My courses</Link>, each
        card has <strong>Teach (preview)</strong> when you have write access — it opens{' '}
        <code>/teach/&lt;courseInstanceId&gt;</code>.
      </p>
      <ul style={{ listStyle: 'none', padding: 0, marginTop: '0.75rem' }}>
        <li>
          <Link href="/dashboard/teach/attendance-qr" style={{ color: '#2563eb', fontWeight: 600 }}>
            Attendance session QR generator
          </Link>
          <span style={{ color: '#94a3b8' }}>
            {' '}
            — issue short-lived JWTs for classroom check-in.
          </span>
        </li>
      </ul>
    </main>
  );
}
