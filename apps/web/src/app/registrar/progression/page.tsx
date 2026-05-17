import Link from 'next/link';
import { auth } from '@/auth';
import { appendOptionalEntityHeader } from '@/lib/api-headers';
import { hasPermission } from '@/lib/permissions';
import { ProgressionBatchForm } from './progression-batch-form';

const apiBase =
  process.env.AUTH_API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

type SemesterRow = { id: string; name: string; startDate: string };

export default async function RegistrarProgressionPage() {
  const session = await auth();
  const token = session?.accessToken;

  if (!token || !session.user?.institutionId) {
    return (
      <main style={{ padding: '2rem', fontFamily: 'system-ui', maxWidth: 720 }}>
        <h1>Progression batch</h1>
        <p style={{ color: '#64748b' }}>Sign in to evaluate academic progression.</p>
        <Link href="/login" style={{ color: '#2563eb' }}>
          Sign in
        </Link>
      </main>
    );
  }

  const canRun =
    hasPermission(session.user.permissions, 'progression.write') ||
    hasPermission(session.user.permissions, 'students.write');

  if (!canRun) {
    return (
      <main style={{ padding: '2rem', fontFamily: 'system-ui', maxWidth: 720 }}>
        <nav style={{ marginBottom: '1rem' }}>
          <Link href="/dashboard" style={{ color: '#2563eb' }}>
            ← Dashboard
          </Link>
        </nav>
        <h1>Progression batch</h1>
        <p style={{ color: '#b91c1c' }}>
          Your account needs progression.write or students.write permission.
        </p>
      </main>
    );
  }

  let semesters: SemesterRow[] = [];
  const h: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    'X-Institution-ID': session.user.institutionId,
  };
  appendOptionalEntityHeader(h, session.user);
  const semRes = await fetch(`${apiBase}/academic/catalog/semesters`, {
    headers: h,
    cache: 'no-store',
  });
  if (semRes.ok) {
    semesters = (await semRes.json()) as SemesterRow[];
  }

  return (
    <main
      style={{
        padding: '2rem 1.5rem 3rem',
        fontFamily: 'system-ui',
        maxWidth: 900,
        margin: '0 auto',
      }}
    >
      <nav style={{ marginBottom: '1.25rem', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
        <Link href="/dashboard" style={{ color: '#2563eb' }}>
          ← Dashboard
        </Link>
        <Link href="/students" style={{ color: '#64748b' }}>
          Students
        </Link>
      </nav>
      <h1 style={{ margin: '0 0 0.35rem', fontFamily: 'Georgia, serif', color: '#0f172a' }}>
        Registrar — progression batch
      </h1>
      <p style={{ color: '#64748b', fontSize: '0.92rem', maxWidth: 640, marginBottom: '1.5rem' }}>
        Evaluates ACTIVE students who have enrolments in the selected semester. Uses cumulative GPA
        with the institution&apos;s repeat policy versus{' '}
        <code style={{ fontSize: '0.82rem' }}>ProgressionRule</code> thresholds. Dry run lists
        recommendations without writing rows; turning dry run off appends PROMOTION/AUTOMATIC
        decisions only where eligible (no duplicates for the same semester).
      </p>
      {semesters.length === 0 ? (
        <p style={{ color: '#b45309' }}>No semesters found — check academic catalog API access.</p>
      ) : (
        <ProgressionBatchForm semesters={semesters} />
      )}
    </main>
  );
}
