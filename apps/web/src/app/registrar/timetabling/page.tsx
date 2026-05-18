import Link from 'next/link';
import { auth } from '@/auth';
import { appendOptionalEntityHeader } from '@/lib/api-headers';
import { hasPermission } from '@/lib/permissions';
import { TimetablingAssistantForm } from './timetabling-assistant-form';

const apiBase =
  process.env.AUTH_API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

type SemesterRow = { id: string; name: string; startDate: string };

export default async function RegistrarTimetablingPage() {
  const session = await auth();
  const token = session?.accessToken;

  if (!token || !session.user?.institutionId) {
    return (
      <main style={{ padding: '2rem', fontFamily: 'system-ui', maxWidth: 720 }}>
        <h1>Timetabling assistant</h1>
        <p style={{ color: '#64748b' }}>Sign in to generate semester schedules.</p>
        <Link href="/login" style={{ color: '#2563eb' }}>
          Sign in
        </Link>
      </main>
    );
  }

  const canRun =
    hasPermission(session.user.permissions, 'academic.write') ||
    hasPermission(session.user.permissions, 'enrollments.write');

  if (!canRun) {
    return (
      <main style={{ padding: '2rem', fontFamily: 'system-ui', maxWidth: 720 }}>
        <nav style={{ marginBottom: '1rem' }}>
          <Link href="/dashboard" style={{ color: '#2563eb' }}>
            ← Dashboard
          </Link>
        </nav>
        <h1>Timetabling assistant</h1>
        <p style={{ color: '#b91c1c' }}>
          Your account needs academic.write or enrollments.write permission.
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
        maxWidth: 960,
        margin: '0 auto',
      }}
    >
      <nav style={{ marginBottom: '1.25rem', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
        <Link href="/dashboard" style={{ color: '#2563eb' }}>
          ← Dashboard
        </Link>
        <Link href="/registrar/progression" style={{ color: '#64748b' }}>
          Progression
        </Link>
      </nav>
      <h1 style={{ margin: '0 0 0.35rem', fontFamily: 'Georgia, serif', color: '#0f172a' }}>
        AI timetabling assistant
      </h1>
      <p style={{ margin: '0 0 1.5rem', color: '#64748b', maxWidth: 640, lineHeight: 1.5 }}>
        Generate up to three conflict-free schedule options for unscheduled sections in a semester.
        Ranked by optimisation score (room use, faculty balance, student clashes). Select one to
        apply.
      </p>
      <TimetablingAssistantForm semesters={semesters} />
    </main>
  );
}
