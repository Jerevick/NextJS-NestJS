import Link from 'next/link';
import { auth } from '@/auth';
import { buildApiHeaders, apiBase } from '@/lib/server-api';
import { AdmissionsKanbanBoard } from '@/components/admissions/admissions-kanban-board';
import {
  AdmissionsDataGrid,
  type ApplicationGridRow,
} from '@/components/data-grids/admissions-data-grid';
import { hasPermission } from '@/lib/permissions';

const primary = '#1e3a5f';
const muted = '#64748b';

type ApplicationRow = {
  id: string;
  status: string;
  createdAt: string;
  acceptedStudentId: string | null;
  cycle: { id: string; name: string };
  program: { id: string; code: string; name: string };
  applicant: {
    id: string;
    email: string;
    profile?: { firstName?: string; lastName?: string } | null;
  };
};

type ListResponse = { data: ApplicationRow[]; total: number };

const FUNNEL_STAGES = [
  { key: 'PENDING', label: 'Applied' },
  { key: 'UNDER_REVIEW', label: 'Under review' },
  { key: 'WAITLISTED', label: 'Waitlisted' },
  { key: 'ACCEPTED', label: 'Accepted' },
  { key: 'enrolled', label: 'Enrolled' },
] as const;

function applicantName(row: ApplicationRow): string {
  const p = row.applicant.profile;
  if (p?.firstName || p?.lastName) {
    return [p.firstName, p.lastName].filter(Boolean).join(' ').trim();
  }
  return row.applicant.email;
}

export default async function AdmissionsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; cycleId?: string }>;
}) {
  const sp = await searchParams;
  const session = await auth();
  const canRead = hasPermission(session?.user?.permissions, 'admissions.read');
  const canWrite = hasPermission(session?.user?.permissions, 'admissions.write');

  if (!session?.accessToken) {
    return (
      <main style={{ padding: '2rem', fontFamily: '"IBM Plex Sans", system-ui' }}>
        <h1 style={{ color: primary, fontFamily: '"Crimson Pro", Georgia, serif' }}>Admissions</h1>
        <p style={{ color: muted }}>Sign in to view applications.</p>
        <Link href="/login" style={{ color: primary }}>
          Sign in
        </Link>
      </main>
    );
  }

  if (!canRead) {
    return (
      <main style={{ padding: '2rem', fontFamily: '"IBM Plex Sans", system-ui' }}>
        <h1 style={{ color: primary, fontFamily: '"Crimson Pro", Georgia, serif' }}>Admissions</h1>
        <p style={{ color: muted }}>You need admissions.read permission.</p>
        <Link href="/dashboard" style={{ color: primary }}>
          Dashboard
        </Link>
      </main>
    );
  }

  const filteredQs = new URLSearchParams({ limit: '200' });
  if (sp.status?.trim()) {
    filteredQs.set('status', sp.status.trim());
  }
  if (sp.cycleId?.trim()) {
    filteredQs.set('cycleId', sp.cycleId.trim());
  }

  const wideQs = new URLSearchParams({ limit: '500' });

  const [res, wideRes, cyclesRes] = await Promise.all([
    fetch(`${apiBase}/admissions/applications?${filteredQs.toString()}`, {
      headers: buildApiHeaders(session),
      cache: 'no-store',
    }),
    fetch(`${apiBase}/admissions/applications?${wideQs.toString()}`, {
      headers: buildApiHeaders(session),
      cache: 'no-store',
    }),
    fetch(`${apiBase}/admissions/cycles?limit=50`, {
      headers: buildApiHeaders(session),
      cache: 'no-store',
    }),
  ]);

  let applications: ApplicationRow[] = [];
  let total = 0;
  if (res.ok) {
    const json = (await res.json()) as ListResponse;
    applications = json.data ?? [];
    total = json.total ?? applications.length;
  }

  let kanbanRows: ApplicationRow[] = [];
  if (wideRes.ok) {
    const wideJson = (await wideRes.json()) as ListResponse;
    kanbanRows = wideJson.data ?? [];
  }

  const cycles = cyclesRes.ok
    ? (((await cyclesRes.json()) as { data?: { id: string; name: string }[] }).data ?? [])
    : [];

  const allForFunnel = kanbanRows.length ? kanbanRows : applications;

  const funnelCounts: Record<string, number> = {
    PENDING: 0,
    UNDER_REVIEW: 0,
    WAITLISTED: 0,
    ACCEPTED: 0,
    enrolled: 0,
  };
  for (const a of allForFunnel) {
    if (a.acceptedStudentId) {
      funnelCounts.enrolled += 1;
    }
    if (a.status in funnelCounts && a.status !== 'enrolled') {
      funnelCounts[a.status] += 1;
    }
  }

  return (
    <main
      style={{
        padding: '2rem 1.5rem',
        fontFamily: '"IBM Plex Sans", system-ui',
        maxWidth: 1100,
        margin: '0 auto',
      }}
    >
      <nav style={{ marginBottom: '1rem', display: 'flex', gap: '1rem' }}>
        <Link href="/dashboard" style={{ color: muted }}>
          Dashboard
        </Link>
        <Link href="/dashboard/students" style={{ color: primary }}>
          Students
        </Link>
      </nav>

      <h1 style={{ margin: 0, fontFamily: '"Crimson Pro", Georgia, serif', color: primary }}>
        Admissions
      </h1>
      <p style={{ color: muted, fontSize: '0.9rem' }}>
        {total} application{total === 1 ? '' : 's'}
        {canWrite ? ' · You can update status on each application.' : ''}
      </p>

      <section
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
          gap: '0.75rem',
          margin: '1.5rem 0',
        }}
      >
        {FUNNEL_STAGES.map((stage) => (
          <div
            key={stage.key}
            style={{
              border: '1px solid #e2e8f0',
              borderRadius: 8,
              padding: '0.75rem',
              background: '#f8fafc',
            }}
          >
            <div style={{ fontSize: '0.75rem', color: muted }}>{stage.label}</div>
            <div
              style={{ fontSize: '1.5rem', fontWeight: 700, fontFamily: 'ui-monospace, monospace' }}
            >
              {funnelCounts[stage.key] ?? 0}
            </div>
          </div>
        ))}
      </section>

      {res.ok && kanbanRows.length > 0 ? (
        <AdmissionsKanbanBoard
          canWrite={canWrite}
          footnote="Board shows up to 500 applications (all cycles and statuses). The table below still uses your filters."
          rows={kanbanRows.map((a) => ({
            id: a.id,
            status: a.status,
            applicantName: applicantName(a),
            programLabel: `${a.program.code} — ${a.program.name}`,
            cycleName: a.cycle.name,
            acceptedStudentId: a.acceptedStudentId,
          }))}
        />
      ) : null}

      <form
        method="get"
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '0.75rem',
          marginBottom: '1.25rem',
          alignItems: 'end',
        }}
      >
        <label style={{ display: 'grid', gap: 4, fontSize: '0.85rem' }}>
          Status
          <select name="status" defaultValue={sp.status ?? ''} style={{ padding: '0.4rem' }}>
            <option value="">All</option>
            {['PENDING', 'UNDER_REVIEW', 'WAITLISTED', 'ACCEPTED', 'REJECTED', 'WITHDRAWN'].map(
              (s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ),
            )}
          </select>
        </label>
        <label style={{ display: 'grid', gap: 4, fontSize: '0.85rem' }}>
          Cycle
          <select name="cycleId" defaultValue={sp.cycleId ?? ''} style={{ padding: '0.4rem' }}>
            <option value="">All cycles</option>
            {cycles.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" style={{ padding: '0.45rem 0.85rem', fontWeight: 600 }}>
          Filter
        </button>
      </form>

      {!res.ok ? (
        <p style={{ color: '#b91c1c' }}>Could not load applications (HTTP {res.status}).</p>
      ) : applications.length === 0 ? (
        <p style={{ color: muted }}>No applications match this filter.</p>
      ) : (
        <AdmissionsDataGrid
          rows={applications.map(
            (a): ApplicationGridRow => ({
              id: a.id,
              applicantName: applicantName(a),
              programLabel: `${a.program.code} — ${a.program.name}`,
              cycleName: a.cycle.name,
              status: a.status,
              acceptedStudentId: a.acceptedStudentId,
              createdAt: a.createdAt,
            }),
          )}
        />
      )}
    </main>
  );
}
