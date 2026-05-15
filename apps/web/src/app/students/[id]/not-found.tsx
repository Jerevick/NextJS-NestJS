import Link from 'next/link';

export default function StudentNotFound() {
  return (
    <main style={{ padding: '2rem', fontFamily: 'system-ui', maxWidth: 560 }}>
      <h1 style={{ fontSize: '1.25rem' }}>Student not found</h1>
      <p style={{ color: '#64748b' }}>This ID is missing or does not belong to your institution.</p>
      <Link href="/students" style={{ color: '#1e3a5f' }}>
        Back to students
      </Link>
    </main>
  );
}
