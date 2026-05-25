import Link from 'next/link';
import { auth } from '@/auth';
import { buildApiHeaders, apiBase } from '@/lib/server-api';
import { hasPermission } from '@/lib/permissions';
import {
  GradeEntryDataGrid,
  type GradeComponentWeightBand,
  type GradeEntryGridRow,
} from '@/components/data-grids/grade-entry-data-grid';

const primary = '#1e3a5f';
const muted = '#64748b';

type SemesterOption = {
  id: string;
  name: string;
  startDate: string;
  academicYear: { name: string };
};

type SectionOption = {
  id: string;
  sectionNumber: string;
  course: { code: string; title: string };
};

type GradeJson = {
  score?: number;
  letterGrade?: string;
  gradePoints?: number;
  workflowStatus?: string;
  components?: Record<string, unknown>;
};

type GovEffective = {
  componentWeights?: { key: string; label?: string; weight: number }[];
};

type EnrollmentRow = {
  id: string;
  student: {
    id: string;
    studentNumber: string;
    profile?: { firstName?: string; lastName?: string } | null;
    email?: string;
  };
  grade: GradeJson | null;
};

function semesterLabel(s: SemesterOption): string {
  return `${s.academicYear?.name ?? 'Year'} — ${s.name}`;
}

function studentLabel(row: EnrollmentRow): string {
  const p = row.student.profile;
  const name =
    p?.firstName || p?.lastName ? [p.firstName, p.lastName].filter(Boolean).join(' ') : null;
  return name ? `${name} (${row.student.studentNumber})` : row.student.studentNumber;
}

export default async function GradeEntryPage({
  searchParams,
}: {
  searchParams: Promise<{ semesterId?: string; sectionId?: string }>;
}) {
  const sp = await searchParams;
  const session = await auth();
  const canEnter =
    hasPermission(session?.user?.permissions, 'grades.enter') ||
    hasPermission(session?.user?.permissions, 'grades.write');

  if (!session?.accessToken) {
    return (
      <main style={{ padding: '2rem' }}>
        <h1 style={{ color: primary, fontFamily: '"Crimson Pro", Georgia, serif' }}>Grade entry</h1>
        <Link href="/login">Sign in</Link>
      </main>
    );
  }

  if (!canEnter) {
    return (
      <main style={{ padding: '2rem' }}>
        <h1 style={{ color: primary, fontFamily: '"Crimson Pro", Georgia, serif' }}>Grade entry</h1>
        <p style={{ color: muted }}>Requires grades.enter or grades.write.</p>
        <Link href="/dashboard">Dashboard</Link>
      </main>
    );
  }

  const headers = buildApiHeaders(session);
  const sectionId = sp.sectionId?.trim();
  const semesterId = sp.semesterId?.trim();

  if (sectionId) {
    const [enrollRes, govRes] = await Promise.all([
      fetch(`${apiBase}/grades/sections/${encodeURIComponent(sectionId)}/enrollments`, {
        headers,
        cache: 'no-store',
      }),
      fetch(`${apiBase}/grades/governance/effective`, { headers, cache: 'no-store' }),
    ]);

    if (!enrollRes.ok) {
      return (
        <main style={{ padding: '2rem' }}>
          <p style={{ color: '#b91c1c' }}>Could not load enrollments ({enrollRes.status}).</p>
          <Link href="/grades/entry">← Start over</Link>
        </main>
      );
    }

    const enrollments = (await enrollRes.json()) as EnrollmentRow[];

    const govJson = govRes.ok ? ((await govRes.json()) as GovEffective) : null;
    const rawWeights =
      govJson?.componentWeights?.filter(
        (w): w is { key: string; label?: string; weight: number } =>
          typeof w?.key === 'string' &&
          w.key.length > 0 &&
          typeof w.weight === 'number' &&
          Number.isFinite(w.weight),
      ) ?? [];

    const componentWeights: GradeComponentWeightBand[] = rawWeights.map(
      (w): GradeComponentWeightBand => ({
        key: w.key,
        label: typeof w.label === 'string' && w.label.trim().length ? w.label.trim() : w.key,
        weight: w.weight,
      }),
    );

    const policyNote =
      componentWeights.length > 0 ? (
        <p
          style={{
            color: muted,
            fontSize: '0.82rem',
            marginTop: '-0.5rem',
            marginBottom: '1rem',
            maxWidth: 720,
          }}
        >
          This institution weights final scores by{' '}
          {componentWeights
            .map((w) => `${w.label} (${Math.round(w.weight * 1000) / 10}%)`)
            .join(', ')}
          . Saving derives the aggregate course score (and maps to letter points when the default
          grading scale defines bands).
        </p>
      ) : null;

    return (
      <main
        style={{
          padding: '2rem 1.5rem',
          maxWidth: 1060,
          margin: '0 auto',
          fontFamily: '"IBM Plex Sans", system-ui',
        }}
      >
        <nav style={{ marginBottom: '1rem' }}>
          <Link href="/grades/entry" style={{ color: primary }}>
            ← Change section
          </Link>
        </nav>
        <h1 style={{ fontFamily: '"Crimson Pro", Georgia, serif', color: primary }}>Grade entry</h1>
        <p style={{ color: muted, fontSize: '0.9rem' }}>{enrollments.length} enrolled student(s)</p>
        {policyNote}
        {hasPermission(session.user.permissions, 'grades.write') ? (
          <p style={{ marginTop: policyNote ? 0 : '0.65rem', fontSize: '0.85rem' }}>
            <Link
              href="/dashboard/settings/grading-weights"
              style={{ color: primary, fontWeight: 600 }}
            >
              Configure grading component weights →
            </Link>
          </p>
        ) : null}

        <GradeEntryDataGrid
          sectionId={sectionId}
          componentWeights={componentWeights}
          rows={enrollments.map((row): GradeEntryGridRow => {
            const g = row.grade ?? {};
            const gradeDisplay = `${g.letterGrade ?? '—'}${g.gradePoints !== undefined ? ` (${g.gradePoints})` : ''}`;
            return {
              id: row.id,
              studentLabel: studentLabel(row),
              gradeDisplay,
              sectionId,
              initialGrade: row.grade,
            };
          })}
        />
      </main>
    );
  }

  const semRes = await fetch(`${apiBase}/academic/catalog/semesters`, {
    headers,
    cache: 'no-store',
  });
  const semesters = semRes.ok ? ((await semRes.json()) as SemesterOption[]) : [];

  let sections: SectionOption[] = [];
  if (semesterId) {
    const secRes = await fetch(
      `${apiBase}/academic/semesters/${encodeURIComponent(semesterId)}/sections`,
      {
        headers,
        cache: 'no-store',
      },
    );
    sections = secRes.ok ? ((await secRes.json()) as SectionOption[]) : [];
  }

  return (
    <main
      style={{
        padding: '2rem 1.5rem',
        maxWidth: 640,
        margin: '0 auto',
        fontFamily: '"IBM Plex Sans", system-ui',
      }}
    >
      <nav style={{ marginBottom: '1rem' }}>
        <Link href="/dashboard" style={{ color: muted }}>
          Dashboard
        </Link>
      </nav>
      <h1 style={{ fontFamily: '"Crimson Pro", Georgia, serif', color: primary }}>Grade entry</h1>
      <p style={{ color: muted, fontSize: '0.9rem' }}>
        Select a semester and section to enter scores. Use Draft, then Submit for HoD review per
        your workflow.
      </p>

      {semesters.length === 0 ? (
        <p>No semesters in catalog.</p>
      ) : (
        <form method="get" style={{ marginTop: '1.5rem', display: 'grid', gap: '1rem' }}>
          <label style={{ display: 'grid', gap: 6 }}>
            Semester
            <select
              name="semesterId"
              required
              defaultValue={semesterId ?? ''}
              style={{ padding: '0.5rem' }}
            >
              <option value="" disabled>
                Select…
              </option>
              {semesters.map((s) => (
                <option key={s.id} value={s.id}>
                  {semesterLabel(s)}
                </option>
              ))}
            </select>
          </label>
          {semesterId && sections.length > 0 ? (
            <label style={{ display: 'grid', gap: 6 }}>
              Section
              <select name="sectionId" required style={{ padding: '0.5rem' }}>
                <option value="" disabled>
                  Select section…
                </option>
                {sections.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.course.code} — {s.course.title} ({s.sectionNumber})
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <button type="submit" style={{ padding: '0.5rem', fontWeight: 600, maxWidth: 220 }}>
            {semesterId && sections.length > 0 ? 'Open gradebook' : 'Load sections'}
          </button>
        </form>
      )}
    </main>
  );
}
