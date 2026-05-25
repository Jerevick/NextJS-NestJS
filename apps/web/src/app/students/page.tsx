import Link from 'next/link';
import { auth } from '@/auth';
import { StudentsDataGrid, type StudentGridRow } from '@/components/data-grids/students-data-grid';
import { hasPermission } from '@/lib/permissions';

const apiBase =
  process.env.AUTH_API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

const ENROLLMENT_STATUSES = [
  'ACTIVE',
  'INACTIVE',
  'SUSPENDED',
  'GRADUATED',
  'WITHDRAWN',
  'DEFERRED',
] as const;

type StudentRow = {
  id: string;
  studentNumber: string;
  email: string;
  enrollmentStatus: string;
  currentLevel: number;
  program: { id: string; name: string; code: string };
  academicMetrics?: {
    cumulativeGpa: number | null;
    creditHoursCompleted?: number;
    academicStanding: string;
  } | null;
};

type ListResponse = {
  data: StudentRow[];
  nextCursor?: string;
  total: number;
};

type ProgramOption = {
  id: string;
  code: string;
  name: string;
  department: { code: string; name: string };
};

function buildStudentsQuery(sp: {
  search?: string;
  programId?: string;
  enrollmentStatus?: string;
}): string {
  const qs = new URLSearchParams();
  qs.set('limit', '50');
  if (sp.search?.trim()) {
    qs.set('search', sp.search.trim());
  }
  if (sp.programId?.trim()) {
    qs.set('programId', sp.programId.trim());
  }
  if (
    sp.enrollmentStatus?.trim() &&
    ENROLLMENT_STATUSES.includes(sp.enrollmentStatus as (typeof ENROLLMENT_STATUSES)[number])
  ) {
    qs.set('enrollmentStatus', sp.enrollmentStatus.trim());
  }
  return qs.toString();
}

function buildStudentsExportQuery(sp: {
  search?: string;
  programId?: string;
  enrollmentStatus?: string;
}): string {
  const qs = new URLSearchParams();
  if (sp.search?.trim()) {
    qs.set('search', sp.search.trim());
  }
  if (sp.programId?.trim()) {
    qs.set('programId', sp.programId.trim());
  }
  if (
    sp.enrollmentStatus?.trim() &&
    ENROLLMENT_STATUSES.includes(sp.enrollmentStatus as (typeof ENROLLMENT_STATUSES)[number])
  ) {
    qs.set('enrollmentStatus', sp.enrollmentStatus.trim());
  }
  return qs.toString();
}

export default async function StudentsPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; programId?: string; enrollmentStatus?: string }>;
}) {
  const sp = await searchParams;
  const session = await auth();
  const token = session?.accessToken;
  const canWrite = hasPermission(session?.user?.permissions, 'students.write');
  const canEnroll = hasPermission(session?.user?.permissions, 'enrollments.write');

  if (!token) {
    return (
      <main style={{ padding: '2rem', fontFamily: 'system-ui', maxWidth: 640 }}>
        <h1>Students</h1>
        <p style={{ color: '#64748b' }}>
          Your session does not include an API access token. Sign in with email and password (and
          institution slug on localhost) to load roster data. OAuth-only sign-in is not yet linked
          to the SIS API.
        </p>
        <p>
          <Link href="/login">Back to sign in</Link>
        </p>
      </main>
    );
  }

  const query = buildStudentsQuery(sp);
  const [listRes, catalogRes] = await Promise.all([
    fetch(`${apiBase}/students?${query}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    }),
    fetch(`${apiBase}/academic/catalog/programs`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    }),
  ]);

  if (!listRes.ok) {
    const body = await listRes.text();
    return (
      <main style={{ padding: '2rem', fontFamily: 'system-ui', maxWidth: 640 }}>
        <h1>Students</h1>
        <p style={{ color: '#b91c1c' }}>Could not load students ({listRes.status}).</p>
        <pre style={{ fontSize: 12, overflow: 'auto' }}>{body}</pre>
        <p>
          <Link href="/dashboard">Dashboard</Link>
        </p>
      </main>
    );
  }

  const payload = (await listRes.json()) as ListResponse;
  const programs: ProgramOption[] = catalogRes.ok
    ? ((await catalogRes.json()) as ProgramOption[])
    : [];
  const exportQuery = buildStudentsExportQuery(sp);
  const exportHref = exportQuery
    ? `/dashboard/students/export?${exportQuery}`
    : '/dashboard/students/export';

  return (
    <main style={{ padding: '2rem', fontFamily: 'system-ui', maxWidth: 1100 }}>
      <nav
        style={{
          marginBottom: '1.5rem',
          display: 'flex',
          gap: '1rem',
          alignItems: 'center',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
        }}
      >
        <Link href="/dashboard">← Dashboard</Link>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {canEnroll ? (
            <Link
              href="/dashboard/students/bulk-enroll"
              style={{
                border: '1px solid #cbd5e1',
                color: '#1e3a5f',
                padding: '0.45rem 0.9rem',
                borderRadius: 6,
                textDecoration: 'none',
                fontWeight: 600,
                fontSize: '0.9rem',
              }}
            >
              Bulk enroll
            </Link>
          ) : null}
          {canWrite ? (
            <Link
              href="/dashboard/students/new"
              style={{
                background: '#1e3a5f',
                color: '#fff',
                padding: '0.45rem 0.9rem',
                borderRadius: 6,
                textDecoration: 'none',
                fontWeight: 600,
                fontSize: '0.9rem',
              }}
            >
              Add student
            </Link>
          ) : null}
        </div>
      </nav>
      <h1 style={{ fontFamily: 'Georgia, serif', color: '#1e3a5f' }}>Students</h1>
      <p style={{ color: '#64748b', fontSize: '0.9rem' }}>
        {payload.total} total · showing {payload.data.length}
      </p>

      <form
        method="get"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: '0.75rem',
          alignItems: 'end',
          marginTop: '1.25rem',
          marginBottom: '1.5rem',
          padding: '1rem',
          background: '#f8fafc',
          borderRadius: 8,
          border: '1px solid #e2e8f0',
        }}
      >
        <label style={{ display: 'grid', gap: 4, fontSize: '0.85rem' }}>
          <span>Search</span>
          <input
            name="search"
            type="search"
            placeholder="Name, student number, or email"
            defaultValue={sp.search ?? ''}
            style={{ padding: '0.45rem' }}
          />
        </label>
        <label style={{ display: 'grid', gap: 4, fontSize: '0.85rem' }}>
          <span>Program</span>
          <select name="programId" defaultValue={sp.programId ?? ''} style={{ padding: '0.45rem' }}>
            <option value="">All programs</option>
            {programs.map((p) => (
              <option key={p.id} value={p.id}>
                {p.code} — {p.name}
              </option>
            ))}
          </select>
        </label>
        <label style={{ display: 'grid', gap: 4, fontSize: '0.85rem' }}>
          <span>Enrollment status</span>
          <select
            name="enrollmentStatus"
            defaultValue={sp.enrollmentStatus ?? ''}
            style={{ padding: '0.45rem' }}
          >
            <option value="">Any status</option>
            {ENROLLMENT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button type="submit" style={{ padding: '0.45rem 0.9rem', fontWeight: 600 }}>
            Apply
          </button>
          <Link
            href="/dashboard/students"
            style={{ padding: '0.45rem 0', alignSelf: 'center', color: '#64748b' }}
          >
            Reset
          </Link>
          <a
            href={exportHref}
            style={{
              padding: '0.45rem 0.75rem',
              alignSelf: 'center',
              color: '#1e3a5f',
              fontWeight: 600,
              border: '1px solid #cbd5e1',
              borderRadius: 6,
              textDecoration: 'none',
              fontSize: '0.85rem',
            }}
          >
            Export CSV
          </a>
        </div>
      </form>
      {!catalogRes.ok ? (
        <p
          style={{
            fontSize: '0.8rem',
            color: '#94a3b8',
            marginTop: '-0.5rem',
            marginBottom: '1rem',
          }}
        >
          Program filter unavailable ({catalogRes.status}). Search and status filters still apply.
        </p>
      ) : null}

      <StudentsDataGrid
        rows={payload.data.map(
          (s): StudentGridRow => ({
            id: s.id,
            studentNumber: s.studentNumber,
            email: s.email ?? '',
            programCode: s.program?.code ?? '',
            programName: s.program?.name ?? '',
            currentLevel: s.currentLevel ?? 0,
            enrollmentStatus: s.enrollmentStatus,
            cumulativeGpa: s.academicMetrics?.cumulativeGpa ?? null,
            creditHoursCompleted: Math.round(s.academicMetrics?.creditHoursCompleted ?? 0),
            academicStanding: s.academicMetrics?.academicStanding ?? '—',
          }),
        )}
      />
      {payload.data.length === 0 ? (
        <p style={{ marginTop: '1rem', color: '#64748b' }}>No students match these filters.</p>
      ) : null}
    </main>
  );
}
