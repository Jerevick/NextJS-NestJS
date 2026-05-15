import Link from 'next/link';
import { auth } from '@/auth';
import { hasPermission } from '@/lib/permissions';
import { BulkEnrollForm } from './bulk-enroll-form';

const apiBase = process.env.AUTH_API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

type SemesterOption = {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  academicYear: { id: string; name: string };
};

type SectionOption = {
  id: string;
  maxEnrollment: number;
  course: { code: string; title: string };
  semester: { id: string; name: string };
};

function formatSemesterLabel(s: SemesterOption): string {
  const start = s.startDate.slice(0, 10);
  const y = s.academicYear?.name ?? 'Year';
  return `${y} — ${s.name} (${start})`;
}

export default async function BulkEnrollPage({
  searchParams,
}: {
  searchParams: Promise<{ semesterId?: string; sectionId?: string }>;
}) {
  const sp = await searchParams;
  const session = await auth();
  const token = session?.accessToken;
  const canEnroll = hasPermission(session?.user?.permissions, 'enrollments.write');

  if (!token) {
    return (
      <main style={{ padding: '2rem', fontFamily: 'system-ui', maxWidth: 640 }}>
        <p>Sign in to use bulk enroll.</p>
        <Link href="/login">Sign in</Link>
      </main>
    );
  }

  if (!canEnroll) {
    return (
      <main style={{ padding: '2rem', fontFamily: 'system-ui', maxWidth: 640 }}>
        <nav style={{ marginBottom: '1rem' }}>
          <Link href="/students">← Students</Link>
        </nav>
        <p style={{ color: '#64748b' }}>You need enrollments.write to bulk enroll.</p>
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
          <Link href="/students">← Students</Link>
        </nav>
        <p style={{ color: '#b91c1c' }}>Could not load semesters ({semRes.status}).</p>
        <pre style={{ fontSize: 12 }}>{detail}</pre>
      </main>
    );
  }

  const semesters = (await semRes.json()) as SemesterOption[];
  const semesterId = sp.semesterId?.trim();
  const sectionId = sp.sectionId?.trim();

  if (!semesterId) {
    return (
      <main style={{ padding: '2rem', fontFamily: 'system-ui', maxWidth: 560 }}>
        <nav style={{ marginBottom: '1rem', display: 'flex', gap: '1rem' }}>
          <Link href="/students">← Students</Link>
        </nav>
        <h1 style={{ color: '#1e3a5f' }}>Bulk enroll</h1>
        <p style={{ color: '#64748b', fontSize: '0.9rem' }}>
          Choose a semester and section, then paste many student ids. Each row calls the same enrollment rules as single enroll (window, capacity, prerequisites).
        </p>
        {semesters.length === 0 ? (
          <p>No semesters configured.</p>
        ) : (
          <form method="get" style={{ marginTop: '1.25rem', display: 'grid', gap: '1rem', maxWidth: 400 }}>
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

  const secRes = await fetch(`${apiBase}/academic/semesters/${encodeURIComponent(semesterId)}/sections`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });

  if (!secRes.ok) {
    const detail = await secRes.text();
    return (
      <main style={{ padding: '2rem', fontFamily: 'system-ui', maxWidth: 640 }}>
        <nav style={{ marginBottom: '1rem' }}>
          <Link href="/students/bulk-enroll">← Change semester</Link>
        </nav>
        <p style={{ color: '#b91c1c' }}>Could not load sections ({secRes.status}).</p>
        <pre style={{ fontSize: 12 }}>{detail}</pre>
      </main>
    );
  }

  const sections = (await secRes.json()) as SectionOption[];

  if (!sectionId) {
    return (
      <main style={{ padding: '2rem', fontFamily: 'system-ui', maxWidth: 560 }}>
        <nav style={{ marginBottom: '1rem' }}>
          <Link href="/students/bulk-enroll">← Change semester</Link>
          <Link href="/students" style={{ marginLeft: '1rem' }}>
            Students
          </Link>
        </nav>
        <h1 style={{ color: '#1e3a5f' }}>Choose section</h1>
        {sections.length === 0 ? (
          <p style={{ color: '#64748b' }}>No sections for this semester.</p>
        ) : (
          <form method="get" style={{ marginTop: '1rem', display: 'grid', gap: '1rem', maxWidth: 480 }}>
            <input type="hidden" name="semesterId" value={semesterId} />
            <label style={{ display: 'grid', gap: 6 }}>
              <span>Section</span>
              <select name="sectionId" required defaultValue="" style={{ padding: '0.5rem' }}>
                <option value="" disabled>
                  Select section
                </option>
                {sections.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.course.code} — {s.course.title} (max {s.maxEnrollment})
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

  const sectionOk = sections.some((s) => s.id === sectionId);
  if (!sectionOk) {
    return (
      <main style={{ padding: '2rem' }}>
        <nav style={{ marginBottom: '1rem' }}>
          <Link href={`/students/bulk-enroll?semesterId=${encodeURIComponent(semesterId)}`}>← Pick section again</Link>
        </nav>
        <p style={{ color: '#b91c1c' }}>That section is not in this semester.</p>
      </main>
    );
  }

  const sem = semesters.find((s) => s.id === semesterId);
  const sec = sections.find((s) => s.id === sectionId);

  return (
    <main style={{ padding: '2rem', fontFamily: 'system-ui', maxWidth: 720 }}>
      <nav style={{ marginBottom: '1rem', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
        <Link href={`/students/bulk-enroll?semesterId=${encodeURIComponent(semesterId)}`}>← Change section</Link>
        <Link href="/students/bulk-enroll">New semester</Link>
        <Link href="/students">Students</Link>
      </nav>
      <h1 style={{ color: '#1e3a5f' }}>Paste student ids</h1>
      <p style={{ color: '#64748b', fontSize: '0.9rem' }}>
        {sem ? formatSemesterLabel(sem) : semesterId} ·{' '}
        <strong>
          {sec?.course.code} {sec?.course.title}
        </strong>
      </p>
      <BulkEnrollForm sectionId={sectionId} />
    </main>
  );
}
