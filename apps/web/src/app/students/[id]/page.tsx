import Link from 'next/link';
import type { ReactNode } from 'react';
import { notFound } from 'next/navigation';
import { auth } from '@/auth';
import { appendOptionalEntityHeader } from '@/lib/api-headers';
import { canAccessBillingNav, hasPermission } from '@/lib/permissions';
import { InactiveStudentBanner } from '@/components/students/status/inactive-banner';
import {
  StudentStatusTimeline,
  type StatusChangeRow,
} from '@/components/students/status/status-timeline';
import { ConfirmGraduationForm } from '@/components/students/status/confirm-graduation-form';
import {
  StudentAttendanceSectionsDataGrid,
  StudentDocumentsDataGrid,
  StudentEnrollmentsDataGrid,
  type AttendanceSectionGridRow,
  type DocumentGridRow,
  type EnrollmentGridRow,
} from '@/components/data-grids/student-profile-data-grids';
import { RequestDocumentForm } from './request-document-form';
import {
  EnrollmentHoldsPanel,
  type EnrollmentHoldRow,
} from '@/components/students/enrollment-holds-panel';
import {
  GraduationClearancePanel,
  type GraduationClearanceRow,
} from '@/components/students/graduation-clearance-panel';
import { StudentFinanceActions } from '@/components/finance/student-finance-actions';
import { StudentFinancePanel } from '@/components/finance/student-finance-panel';
import { StudentPayOnlineButton } from '@/components/finance/student-pay-online-button';
import { StudentPaymentPlanForm } from '@/components/finance/student-payment-plan-form';
import { StudentProgressionInsights } from '@/components/students/student-progression-insights';
import { StudentAcademicInsightsPanel } from '@/components/students/student-academic-insights-panel';
import { StudentAiAdvisorPanel } from '@/components/students/student-ai-advisor-panel';

const apiBase =
  process.env.AUTH_API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

const primary = '#1e3a5f';
const accent = '#f59e0b';
const muted = '#64748b';
const border = '#e2e8f0';

type StudentDetail = {
  id: string;
  userId: string;
  studentNumber: string;
  email: string;
  profile: { firstName?: string; lastName?: string } | null;
  program: { id: string; name: string; code: string };
  entity?: { id: string; code: string; name: string; type: string; status: string };
  currentLevel: number;
  enrollmentStatus: string;
  admissionDate: string | null;
  expectedGraduationDate: string | null;
  guardians: unknown;
  emergencyContacts: unknown;
  specialNeeds: unknown;
  photo: string | null;
  userActive: boolean;
  enrollments: Array<{
    id: string;
    status: string;
    grade: unknown;
    enrolledAt: string;
    semester: { id: string; name: string; startDate: string };
    course: { code: string; title: string; creditHours: number };
    sectionId: string;
    originalSemesterId: string | null;
    enrollmentAttemptNumber: number;
  }>;
  metrics: {
    gpa: number | null;
    creditHoursAttempted: number;
    creditHoursEarned: number;
    standing: string;
    gpaRepeatPolicy?: string;
  };
};

type DocumentRow = {
  id: string;
  type: string;
  title: string;
  status: string;
  requestedAt: string;
  issuedAt: string | null;
  expiresAt: string | null;
};

type GpaInsightContribution = { courseId: string; gradePoints: number; creditHours: number };

function parseProgressionGpaPayload(raw: unknown): {
  policy: string;
  cumulativeGpa: number | null;
  creditHoursGradedUsed: number;
  contributions: GpaInsightContribution[];
} | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }
  const j = raw as Record<string, unknown>;
  if (typeof j.policy !== 'string') {
    return null;
  }
  const cg = j.cumulativeGpa;
  const cumulativeGpa = typeof cg === 'number' ? cg : cg === null ? null : null;
  const ch = j.creditHoursGradedUsed;
  const creditHoursGradedUsed = typeof ch === 'number' ? ch : 0;
  const contributions: GpaInsightContribution[] = [];
  if (Array.isArray(j.contributions)) {
    for (const item of j.contributions) {
      if (
        item &&
        typeof item === 'object' &&
        typeof (item as GpaInsightContribution).courseId === 'string' &&
        typeof (item as GpaInsightContribution).gradePoints === 'number' &&
        typeof (item as GpaInsightContribution).creditHours === 'number'
      ) {
        contributions.push(item as GpaInsightContribution);
      }
    }
  }
  return { policy: j.policy, cumulativeGpa, creditHoursGradedUsed, contributions };
}

function displayName(s: StudentDetail): string {
  const p = s.profile;
  if (p && (p.firstName || p.lastName)) {
    return [p.firstName, p.lastName].filter(Boolean).join(' ').trim();
  }
  return s.email;
}

function formatDate(iso: string | null): string {
  if (!iso) {
    return '—';
  }
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return iso;
  }
}

type ProfileTab = 'summary' | 'academic' | 'documents' | 'attendance' | 'status' | 'financial';

function tabHref(id: string, tab: ProfileTab): string {
  return tab === 'summary' ? `/students/${id}` : `/students/${id}?tab=${tab}`;
}

function parseTab(raw: string | undefined): ProfileTab {
  if (
    raw === 'academic' ||
    raw === 'documents' ||
    raw === 'attendance' ||
    raw === 'status' ||
    raw === 'financial'
  ) {
    return raw;
  }
  return 'summary';
}

function tabStyle(active: boolean) {
  return {
    padding: '0.4rem 0.75rem',
    borderRadius: 6,
    textDecoration: 'none' as const,
    fontWeight: 600,
    fontSize: '0.9rem',
    border: `1px solid ${active ? primary : border}`,
    background: active ? '#eff6ff' : '#fff',
    color: active ? primary : muted,
  };
}

export default async function StudentProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const tab = parseTab(sp.tab);

  const session = await auth();
  const token = session?.accessToken;
  const canWrite = hasPermission(session?.user?.permissions, 'students.write');
  const canEnroll = hasPermission(session?.user?.permissions, 'enrollments.write');
  const canDocsRead = hasPermission(session?.user?.permissions, 'documents.read');
  const canDocsWrite = hasPermission(session?.user?.permissions, 'documents.write');
  const canStudentsRead = hasPermission(session?.user?.permissions, 'students.read');
  const canStudentsWrite = hasPermission(session?.user?.permissions, 'students.write');
  const canAttendanceRead =
    hasPermission(session?.user?.permissions, 'attendance.read') ||
    hasPermission(session?.user?.permissions, 'students.read');
  const canFinanceTab =
    hasPermission(session?.user?.permissions, 'finance.read') ||
    hasPermission(session?.user?.permissions, 'finance.write') ||
    canAccessBillingNav(session?.user?.permissions);

  if (!token) {
    return (
      <main style={{ padding: '2rem', fontFamily: 'var(--font-sans), system-ui', maxWidth: 720 }}>
        <h1 style={{ fontFamily: 'var(--font-serif), Georgia, serif', color: primary }}>
          Student profile
        </h1>
        <p style={{ color: muted }}>
          Sign in with email and password (institution slug on localhost) so the app can call the
          SIS API.
        </p>
        <Link href="/login" style={{ color: primary }}>
          Sign in
        </Link>
      </main>
    );
  }

  const res = await fetch(`${apiBase}/students/${encodeURIComponent(id)}`, {
    headers: (() => {
      const h: Record<string, string> = {
        Authorization: `Bearer ${token}`,
        'X-Institution-ID': session.user.institutionId,
      };
      appendOptionalEntityHeader(h, session.user);
      return h;
    })(),
    cache: 'no-store',
  });

  if (res.status === 404) {
    notFound();
  }

  if (!res.ok) {
    const body = await res.text();
    return (
      <main style={{ padding: '2rem', fontFamily: 'var(--font-sans), system-ui', maxWidth: 720 }}>
        <nav style={{ marginBottom: '1rem' }}>
          <Link href="/dashboard/students" style={{ color: primary }}>
            ← Students
          </Link>
        </nav>
        <h1 style={{ fontFamily: 'var(--font-serif), Georgia, serif', color: primary }}>
          Could not load student
        </h1>
        <p style={{ color: '#b91c1c' }}>HTTP {res.status}</p>
        <pre style={{ fontSize: 12, overflow: 'auto', background: '#f8fafc', padding: '1rem' }}>
          {body}
        </pre>
      </main>
    );
  }

  const student = (await res.json()) as StudentDetail;
  const name = displayName(student);
  const profilePath = `/dashboard/students/${id}`;
  const profileReadOnly = student.enrollmentStatus !== 'ACTIVE';

  let graduationClearanceRequests: GraduationClearanceRow[] = [];
  if (canStudentsRead) {
    const clearanceRes = await fetch(
      `${apiBase}/graduation-clearance/students/${encodeURIComponent(id)}`,
      {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      },
    );
    if (clearanceRes.ok) {
      const payload = (await clearanceRes.json()) as { data: GraduationClearanceRow[] };
      graduationClearanceRequests = payload.data;
    }
  }

  let enrollmentHolds: EnrollmentHoldRow[] = [];
  if (canEnroll) {
    const holdsRes = await fetch(
      `${apiBase}/students/${encodeURIComponent(id)}/enrollment-holds?activeOnly=false`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'X-Institution-ID': session.user.institutionId,
        },
        cache: 'no-store',
      },
    );
    if (holdsRes.ok) {
      const holdsPayload = (await holdsRes.json()) as { data: EnrollmentHoldRow[] };
      enrollmentHolds = holdsPayload.data;
    }
  }

  let statusEntries: StatusChangeRow[] = [];
  if (canStudentsRead) {
    const logRes = await fetch(`${apiBase}/students/${encodeURIComponent(id)}/status-changes`, {
      headers: (() => {
        const h: Record<string, string> = {
          Authorization: `Bearer ${token}`,
          'X-Institution-ID': session.user.institutionId,
        };
        appendOptionalEntityHeader(h, session.user);
        return h;
      })(),
      cache: 'no-store',
    });
    if (logRes.ok) {
      const logJson = (await logRes.json()) as { data?: StatusChangeRow[] };
      statusEntries = logJson.data ?? [];
    }
  }

  type AttendanceSummary = {
    totalSessions: number;
    byStatus: Record<string, number>;
    bySection: { sectionId: string; total: number; counts: Record<string, number> }[];
  };
  let attendanceSummary: AttendanceSummary | null = null;
  if (tab === 'attendance' && canAttendanceRead) {
    const attRes = await fetch(`${apiBase}/attendance/students/${encodeURIComponent(id)}/summary`, {
      headers: (() => {
        const h: Record<string, string> = {
          Authorization: `Bearer ${token}`,
          'X-Institution-ID': session.user.institutionId,
        };
        appendOptionalEntityHeader(h, session.user);
        return h;
      })(),
      cache: 'no-store',
    });
    if (attRes.ok) {
      attendanceSummary = (await attRes.json()) as AttendanceSummary;
    }
  }

  let documentsPayload: { data: DocumentRow[]; total: number } | null = null;
  if (tab === 'documents' && canDocsRead) {
    const dRes = await fetch(
      `${apiBase}/documents?${new URLSearchParams({ ownerId: student.userId, limit: '50' }).toString()}`,
      {
        headers: (() => {
          const h: Record<string, string> = {
            Authorization: `Bearer ${token}`,
            'X-Institution-ID': session.user.institutionId,
          };
          appendOptionalEntityHeader(h, session.user);
          return h;
        })(),
        cache: 'no-store',
      },
    );
    if (dRes.ok) {
      documentsPayload = (await dRes.json()) as { data: DocumentRow[]; total: number };
    }
  }

  type StudentFinancePayload = {
    studentNumber: string;
    enrollmentStatus: string;
    account: { balance: number; currency: string; lastTransactionAt: string | null };
    paymentPlans?: Array<{
      id: string;
      totalAmount: number;
      status: string;
      installments: Array<{ dueDate: string; amount: number; paidAmount: number; status: string }>;
    }>;
    transactions: Array<{
      id: string;
      type: string;
      amount: number;
      currency: string;
      description: string;
      reference: string;
      status: string;
      createdAt: string;
    }>;
  };
  let financePayload: StudentFinancePayload | null = null;
  let financeError: string | null = null;
  if (
    tab === 'financial' &&
    canFinanceTab &&
    hasPermission(session?.user?.permissions, 'finance.read')
  ) {
    const finRes = await fetch(`${apiBase}/finance/students/${encodeURIComponent(id)}/account`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
    if (finRes.ok) {
      financePayload = (await finRes.json()) as StudentFinancePayload;
    } else {
      financeError = `Could not load ledger (${finRes.status})`;
    }
  }

  let progressionInsights: ReactNode = null;
  if (tab === 'academic' && canStudentsRead && session.user.institutionId) {
    const progressionHeaders = (): Record<string, string> => {
      const h: Record<string, string> = {
        Authorization: `Bearer ${token}`,
        'X-Institution-ID': session.user.institutionId,
      };
      appendOptionalEntityHeader(h, session.user);
      return h;
    };
    const [gpaRes, decRes, progHoldRes, covRes] = await Promise.all([
      fetch(`${apiBase}/sis/progression/students/${encodeURIComponent(id)}/gpa`, {
        headers: progressionHeaders(),
        cache: 'no-store',
      }),
      fetch(`${apiBase}/sis/progression/students/${encodeURIComponent(id)}/decisions`, {
        headers: progressionHeaders(),
        cache: 'no-store',
      }),
      fetch(`${apiBase}/sis/progression/students/${encodeURIComponent(id)}/holds`, {
        headers: progressionHeaders(),
        cache: 'no-store',
      }),
      fetch(`${apiBase}/sis/progression/students/${encodeURIComponent(id)}/carryovers`, {
        headers: progressionHeaders(),
        cache: 'no-store',
      }),
    ]);

    const gpaParsed = gpaRes.ok ? parseProgressionGpaPayload(await gpaRes.json()) : null;

    let decisionsData: { id: string; kind: string; createdAt: string }[] = [];
    if (decRes.ok) {
      const j = (await decRes.json()) as {
        data?: { id: string; kind: string; createdAt: string }[];
      };
      decisionsData = j.data ?? [];
    }

    let progressionHoldsData: {
      id: string;
      type: string;
      reason: string | null;
      createdAt: string;
    }[] = [];
    if (progHoldRes.ok) {
      const j = (await progHoldRes.json()) as {
        data?: { id: string; type: string; reason: string | null; createdAt: string }[];
      };
      progressionHoldsData = j.data ?? [];
    }

    type CarryPayload = {
      id: string;
      original: { enrollmentId: string; courseCode: string; semesterName: string | null };
      repeat: { enrollmentId: string; courseCode: string; semesterName: string | null };
    };
    let carryoversData: CarryPayload[] = [];
    if (covRes.ok) {
      const j = (await covRes.json()) as { data?: CarryPayload[] };
      carryoversData = j.data ?? [];
    }

    progressionInsights = (
      <StudentProgressionInsights
        primary={primary}
        muted={muted}
        border={border}
        gpa={gpaParsed}
        decisions={decisionsData}
        progressionHolds={progressionHoldsData}
        carryovers={carryoversData}
      />
    );
  }

  return (
    <main
      style={{
        padding: '2rem 1.5rem 3rem',
        fontFamily: 'var(--font-sans), "IBM Plex Sans", system-ui',
        maxWidth: 960,
        margin: '0 auto',
        color: '#0f172a',
      }}
    >
      <nav style={{ marginBottom: '1.25rem', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
        <Link
          href="/dashboard/students"
          style={{ color: primary, textDecoration: 'none', fontWeight: 500 }}
        >
          ← Students
        </Link>
        <Link href="/dashboard" style={{ color: muted, textDecoration: 'none' }}>
          Dashboard
        </Link>
        {canEnroll && !profileReadOnly ? (
          <Link
            href={`/dashboard/students/${id}/enroll`}
            style={{ color: primary, textDecoration: 'none', fontWeight: 600 }}
          >
            Enroll in section
          </Link>
        ) : null}
        {canEnroll && !profileReadOnly ? (
          <Link
            href="/dashboard/students/bulk-enroll"
            style={{ color: muted, textDecoration: 'none', fontWeight: 600 }}
          >
            Bulk enroll
          </Link>
        ) : null}
        {canWrite ? (
          <Link
            href="/dashboard/students/new"
            style={{ color: accent, textDecoration: 'none', fontWeight: 600 }}
          >
            Add student
          </Link>
        ) : null}
      </nav>

      <header
        style={{
          borderBottom: `2px solid ${border}`,
          paddingBottom: '1.5rem',
          marginBottom: '1.5rem',
        }}
      >
        <p
          style={{
            margin: 0,
            fontSize: '0.8rem',
            letterSpacing: '0.06em',
            color: muted,
            textTransform: 'uppercase',
          }}
        >
          Student record
        </p>
        <h1
          style={{
            margin: '0.35rem 0 0',
            fontFamily: 'var(--font-serif), Georgia, serif',
            fontSize: '2rem',
            fontWeight: 600,
            color: primary,
          }}
        >
          {name}
        </h1>
        <p style={{ margin: '0.5rem 0 0', color: muted, fontSize: '0.95rem' }}>
          {student.studentNumber} · {student.email}
          {!student.userActive ? (
            <span style={{ marginLeft: '0.5rem', color: '#b91c1c', fontWeight: 600 }}>
              Account inactive
            </span>
          ) : null}
        </p>
        <div
          style={{
            marginTop: '1rem',
            display: 'flex',
            flexWrap: 'wrap',
            gap: '0.5rem',
            alignItems: 'center',
          }}
        >
          <span
            style={{
              background: '#eff6ff',
              color: primary,
              padding: '0.25rem 0.65rem',
              borderRadius: 6,
              fontSize: '0.85rem',
              fontWeight: 600,
            }}
          >
            {student.program.code} — {student.program.name}
          </span>
          <span
            style={{
              background: '#f1f5f9',
              padding: '0.25rem 0.65rem',
              borderRadius: 6,
              fontSize: '0.85rem',
            }}
          >
            Level {student.currentLevel}
          </span>
          <span
            style={{
              border: `1px solid ${border}`,
              padding: '0.25rem 0.65rem',
              borderRadius: 6,
              fontSize: '0.85rem',
            }}
          >
            {student.enrollmentStatus}
          </span>
          <span
            style={{
              background: '#fffbeb',
              color: '#92400e',
              border: `1px solid ${accent}`,
              padding: '0.25rem 0.65rem',
              borderRadius: 6,
              fontSize: '0.85rem',
              fontWeight: 600,
            }}
          >
            Standing: {student.metrics.standing}
          </span>
        </div>
      </header>

      <InactiveStudentBanner
        enrollmentStatus={student.enrollmentStatus}
        campusLabel={student.entity?.name}
        studentId={student.id}
      />

      <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
        <Link href={tabHref(id, 'summary')} style={tabStyle(tab === 'summary')}>
          Summary
        </Link>
        <Link href={tabHref(id, 'academic')} style={tabStyle(tab === 'academic')}>
          Academic
        </Link>
        {canDocsRead ? (
          <Link href={tabHref(id, 'documents')} style={tabStyle(tab === 'documents')}>
            Documents
          </Link>
        ) : null}
        {canAttendanceRead ? (
          <Link href={tabHref(id, 'attendance')} style={tabStyle(tab === 'attendance')}>
            Attendance
          </Link>
        ) : null}
        {canStudentsRead ? (
          <Link href={tabHref(id, 'status')} style={tabStyle(tab === 'status')}>
            Status
          </Link>
        ) : null}
        {canFinanceTab ? (
          <Link href={tabHref(id, 'financial')} style={tabStyle(tab === 'financial')}>
            Financial
          </Link>
        ) : null}
      </div>

      {tab === 'summary' ? (
        <>
          <section
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
              gap: '1rem',
              marginBottom: '2rem',
            }}
          >
            <MetricCard
              label="GPA"
              value={student.metrics.gpa !== null ? String(student.metrics.gpa) : '—'}
              hint={
                student.metrics.gpaRepeatPolicy
                  ? `Repeat policy: ${student.metrics.gpaRepeatPolicy}`
                  : undefined
              }
            />
            <MetricCard
              label="Credits attempted"
              value={String(student.metrics.creditHoursAttempted)}
            />
            <MetricCard label="Credits earned" value={String(student.metrics.creditHoursEarned)} />
            <MetricCard label="Admission" value={formatDate(student.admissionDate)} />
            <MetricCard
              label="Expected graduation"
              value={formatDate(student.expectedGraduationDate)}
            />
          </section>

          <StudentAcademicInsightsPanel
            primary={primary}
            accent={accent}
            muted={muted}
            gpa={student.metrics.gpa}
            standing={student.metrics.standing}
            creditsEarned={student.metrics.creditHoursEarned}
          />

          <StudentAiAdvisorPanel
            studentId={student.id}
            primary={primary}
            accent={accent}
            muted={muted}
          />

          <section style={{ marginBottom: '2rem' }}>
            <h2
              style={{
                fontFamily: 'var(--font-serif), Georgia, serif',
                fontSize: '1.35rem',
                color: primary,
                marginBottom: '0.75rem',
              }}
            >
              Overview
            </h2>
            <p style={{ color: muted, fontSize: '0.9rem', margin: '0 0 1rem' }}>
              Guardian and emergency contact JSON is stored on the server; structured editing can be
              added later.
            </p>
            <dl
              style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(8rem, auto) 1fr',
                gap: '0.5rem 1rem',
                fontSize: '0.9rem',
                margin: 0,
              }}
            >
              <dt style={{ color: muted }}>User ID</dt>
              <dd style={{ margin: 0 }}>{student.userId}</dd>
              <dt style={{ color: muted }}>Program ID</dt>
              <dd style={{ margin: 0 }}>{student.program.id}</dd>
            </dl>
          </section>
        </>
      ) : null}

      {tab === 'status' && canStudentsRead ? (
        <section style={{ marginBottom: '2rem' }}>
          <h2
            style={{
              fontFamily: 'var(--font-serif), Georgia, serif',
              fontSize: '1.35rem',
              color: primary,
              marginBottom: '0.75rem',
            }}
          >
            Enrollment status history
          </h2>
          {statusEntries.length > 0 ? (
            <StudentStatusTimeline entries={statusEntries} />
          ) : (
            <p style={{ color: muted }}>No status changes recorded.</p>
          )}
          {canStudentsWrite ? (
            <GraduationClearancePanel
              studentId={student.id}
              requests={graduationClearanceRequests}
              readOnly={profileReadOnly}
            />
          ) : null}
          {student.enrollmentStatus === 'ACTIVE' && canStudentsWrite ? (
            <ConfirmGraduationForm
              studentId={student.id}
              studentProfilePath={profilePath}
              readOnly={profileReadOnly}
            />
          ) : null}
          <p style={{ marginTop: '1.5rem', fontSize: '0.9rem' }}>
            <Link
              href="/dashboard/students/reactivation"
              style={{ color: primary, fontWeight: 600 }}
            >
              Reactivation requests →
            </Link>
          </p>
        </section>
      ) : null}

      {tab === 'attendance' && canAttendanceRead ? (
        <section>
          <h2
            style={{
              fontFamily: 'var(--font-serif), Georgia, serif',
              fontSize: '1.35rem',
              color: primary,
              marginBottom: '0.75rem',
            }}
          >
            Attendance summary
          </h2>
          {!attendanceSummary ? (
            <p style={{ color: muted }}>Could not load attendance data.</p>
          ) : (
            <>
              <p style={{ color: muted, fontSize: '0.9rem' }}>
                Total sessions recorded: <strong>{attendanceSummary.totalSessions}</strong>
              </p>
              {Object.keys(attendanceSummary.byStatus).length > 0 ? (
                <ul style={{ marginTop: '1rem', paddingLeft: '1.25rem' }}>
                  {Object.entries(attendanceSummary.byStatus).map(([status, count]) => (
                    <li key={status} style={{ marginBottom: 4 }}>
                      {status}: {count}
                    </li>
                  ))}
                </ul>
              ) : null}
              {attendanceSummary.bySection.length > 0 ? (
                <StudentAttendanceSectionsDataGrid
                  rows={attendanceSummary.bySection.map(
                    (s): AttendanceSectionGridRow => ({
                      id: s.sectionId,
                      sectionId: s.sectionId,
                      total: s.total,
                    }),
                  )}
                />
              ) : null}
            </>
          )}
        </section>
      ) : null}

      {tab === 'financial' && canFinanceTab ? (
        <section style={{ marginBottom: '2rem' }}>
          <h2
            style={{
              fontFamily: 'var(--font-serif), Georgia, serif',
              fontSize: '1.35rem',
              color: primary,
              marginBottom: '0.75rem',
            }}
          >
            Financial account
          </h2>
          {hasPermission(session?.user?.permissions, 'finance.read') ? (
            <>
              <StudentFinancePanel
                payload={financePayload}
                error={financeError}
                studentId={id}
                showReceiptLinks
              />
              <StudentFinanceActions
                studentId={id}
                canWrite={hasPermission(session?.user?.permissions, 'finance.write')}
                enrollmentStatus={student.enrollmentStatus}
              />
              {financePayload ? (
                <StudentPayOnlineButton
                  studentId={id}
                  balance={financePayload.account.balance}
                  currency={financePayload.account.currency}
                />
              ) : null}
              <StudentPaymentPlanForm
                studentId={id}
                currency={financePayload?.account.currency ?? 'USD'}
                canWrite={hasPermission(session?.user?.permissions, 'finance.write')}
                existingPlans={financePayload?.paymentPlans ?? []}
              />
            </>
          ) : (
            <p style={{ color: muted }}>You need finance.read to view the student ledger.</p>
          )}
          <p style={{ marginTop: '1rem', fontSize: '0.85rem' }}>
            <Link href="/dashboard/finance" style={{ color: '#2563eb', fontWeight: 600 }}>
              Institution finance hub →
            </Link>
          </p>
        </section>
      ) : null}

      {tab === 'academic' ? (
        <section>
          {progressionInsights}
          <h2
            style={{
              fontFamily: 'var(--font-serif), Georgia, serif',
              fontSize: '1.35rem',
              color: primary,
              marginBottom: '0.75rem',
            }}
          >
            Enrollments
          </h2>
          <p style={{ color: muted, fontSize: '0.85rem', marginBottom: '0.75rem' }}>
            Drop uses the same add/drop window rules as the API. Only active ENROLLED rows show a
            drop control.
          </p>
          {canEnroll ? (
            <EnrollmentHoldsPanel
              studentId={id}
              holds={enrollmentHolds}
              readOnly={profileReadOnly}
            />
          ) : null}
          {student.enrollments.length === 0 ? (
            <p style={{ color: muted }}>No section enrollments yet.</p>
          ) : (
            <StudentEnrollmentsDataGrid
              rows={student.enrollments.map(
                (e): EnrollmentGridRow => ({
                  id: e.id,
                  courseLabel: `${e.course.code} ${e.course.title}`,
                  semesterName: e.semester.name,
                  status: e.status,
                  creditHours: e.course.creditHours,
                  enrollmentAttemptNumber: e.enrollmentAttemptNumber ?? 1,
                  enrolledAt: formatDate(e.enrolledAt),
                  showDrop: e.status === 'ENROLLED',
                }),
              )}
              profilePath={profilePath}
              profileReadOnly={profileReadOnly}
              showActions={canEnroll}
            />
          )}
        </section>
      ) : null}

      {tab === 'documents' && canDocsRead ? (
        <section>
          <h2
            style={{
              fontFamily: 'var(--font-serif), Georgia, serif',
              fontSize: '1.35rem',
              color: primary,
              marginBottom: '0.75rem',
            }}
          >
            Documents
          </h2>
          {canDocsWrite ? (
            <RequestDocumentForm
              ownerId={student.userId}
              studentProfilePath={profilePath}
              readOnly={profileReadOnly}
            />
          ) : (
            <p style={{ color: muted, fontSize: '0.85rem' }}>
              You can view documents but not create requests.
            </p>
          )}
          {!documentsPayload ? (
            <p style={{ color: '#b91c1c', marginTop: '1rem' }}>
              Could not load documents for this user.
            </p>
          ) : documentsPayload.data.length === 0 ? (
            <p style={{ color: muted, marginTop: '1rem' }}>No document records yet.</p>
          ) : (
            <div style={{ marginTop: '1rem' }}>
              <StudentDocumentsDataGrid
                rows={documentsPayload.data.map(
                  (d): DocumentGridRow => ({
                    id: d.id,
                    type: d.type,
                    title: d.title,
                    status: d.status,
                    requestedAt: formatDate(d.requestedAt),
                    issuedAt: formatDate(d.issuedAt),
                  }),
                )}
              />
              <p style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: muted }}>
                {documentsPayload.total} total (showing {documentsPayload.data.length})
              </p>
            </div>
          )}
        </section>
      ) : null}

      {tab === 'documents' && !canDocsRead ? (
        <p style={{ color: muted }}>You do not have permission to view documents.</p>
      ) : null}
    </main>
  );
}

function MetricCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div
      style={{
        border: `1px solid ${border}`,
        borderRadius: 8,
        padding: '0.75rem 1rem',
        background: '#fff',
      }}
    >
      <p
        style={{
          margin: 0,
          fontSize: '0.72rem',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          color: muted,
        }}
      >
        {label}
      </p>
      <p style={{ margin: '0.35rem 0 0', fontSize: '1.15rem', fontWeight: 600, color: primary }}>
        {value}
      </p>
      {hint ? (
        <p style={{ margin: '0.35rem 0 0', fontSize: '0.72rem', color: muted, fontWeight: 500 }}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}
