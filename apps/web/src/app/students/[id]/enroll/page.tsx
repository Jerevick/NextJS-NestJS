import Link from 'next/link';
import { auth } from '@/auth';
import { hasPermission } from '@/lib/permissions';
import { EnrollSectionForm, type SectionOption } from './enroll-section-form';

const apiBase = process.env.AUTH_API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

type SemesterOption = {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  academicYear: { id: string; name: string };
};

function formatSemesterLabel(s: SemesterOption): string {
  const start = s.startDate.slice(0, 10);
  const y = s.academicYear?.name ?? 'Year';
  return `${y} — ${s.name} (${start})`;
}

export default async function StudentEnrollPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ semesterId?: string }>;
}) {
  const { id: studentId } = await params;
  const { semesterId } = await searchParams;
  const session = await auth();
  const token = session?.accessToken;
  const canEnroll = hasPermission(session?.user?.permissions, 'enrollments.write');

  if (!token) {
    return (
      <main style={{ padding: '2rem', fontFamily: 'system-ui', maxWidth: 640 }}>
        <p>Sign in to enroll students.</p>
        <Link href="/login">Sign in</Link>
      </main>
    );
  }

  if (!canEnroll) {
    return (
      <main style={{ padding: '2rem', fontFamily: 'system-ui', maxWidth: 640 }}>
        <nav style={{ marginBottom: '1rem' }}>
          <Link href={`/students/${studentId}`}>← Student</Link>
        </nav>
        <h1>Enroll</h1>
        <p style={{ color: '#64748b' }}>Your account does not have permission to create enrollments.</p>
      </main>
    );
  }

  const semRes = await fetch(`${apiBase}/academic/catalog/semesters`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });

  if (!semRes.ok) {
    const detail = await semRes.text();
    return (
      <main style={{ padding: '2rem', fontFamily: 'system-ui', maxWidth: 640 }}>
        <nav style={{ marginBottom: '1rem' }}>
          <Link href={`/students/${studentId}`}>← Student</Link>
        </nav>
        <p style={{ color: '#b91c1c' }}>Could not load semesters ({semRes.status}).</p>
        <pre style={{ fontSize: 12 }}>{detail}</pre>
      </main>
    );
  }

  const semesters = (await semRes.json()) as SemesterOption[];

  if (!semesterId?.trim()) {
    return (
      <main style={{ padding: '2rem', fontFamily: 'system-ui', maxWidth: 560 }}>
        <nav style={{ marginBottom: '1rem', display: 'flex', gap: '1rem' }}>
          <Link href={`/students/${studentId}`}>← Student profile</Link>
          <Link href="/students">Students</Link>
        </nav>
        <h1 style={{ color: '#1e3a5f' }}>Enroll in a section</h1>
        <p style={{ color: '#64748b', fontSize: '0.9rem' }}>
          Choose a semester, then pick a course section. The API enforces add/drop windows, capacity, and prerequisites.
        </p>
        {semesters.length === 0 ? (
          <p style={{ marginTop: '1rem' }}>No semesters found. Create academic years and semesters first.</p>
        ) : (
          <form method="get" style={{ marginTop: '1.5rem', display: 'grid', gap: '1rem', maxWidth: 400 }}>
            <label style={{ display: 'grid', gap: 6 }}>
              <span>Semester</span>
              <select name="semesterId" required defaultValue="" style={{ padding: '0.5rem' }}>
                <option value="" disabled>
                  Select semester
                </option>
                {semesters.map((s) => (
                  <option key={s.id} value={s.id}>
                    {formatSemesterLabel(s)}
                  </option>
                ))}
              </select>
            </label>
            <button type="submit" style={{ padding: '0.55rem', fontWeight: 600 }}>
              Continue
            </button>
          </form>
        )}
      </main>
    );
  }

  const secRes = await fetch(`${apiBase}/academic/semesters/${encodeURIComponent(semesterId.trim())}/sections`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });

  if (!secRes.ok) {
    const detail = await secRes.text();
    return (
      <main style={{ padding: '2rem', fontFamily: 'system-ui', maxWidth: 640 }}>
        <nav style={{ marginBottom: '1rem' }}>
          <Link href={`/students/${studentId}/enroll`}>← Choose semester</Link>
        </nav>
        <p style={{ color: '#b91c1c' }}>Could not load sections ({secRes.status}).</p>
        <pre style={{ fontSize: 12 }}>{detail}</pre>
      </main>
    );
  }

  const sections = (await secRes.json()) as SectionOption[];

  const sem = semesters.find((s) => s.id === semesterId.trim());

  return (
    <main style={{ padding: '2rem', fontFamily: 'system-ui', maxWidth: 640 }}>
      <nav style={{ marginBottom: '1rem', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
        <Link href={`/students/${studentId}/enroll`}>← Change semester</Link>
        <Link href={`/students/${studentId}`}>Student profile</Link>
      </nav>
      <h1 style={{ color: '#1e3a5f' }}>Pick a section</h1>
      <p style={{ color: '#64748b', fontSize: '0.9rem' }}>
        {sem ? formatSemesterLabel(sem) : `Semester ${semesterId}`}
      </p>
      <EnrollSectionForm studentId={studentId} sections={sections} />
    </main>
  );
}
