import Link from 'next/link';
import { notFound } from 'next/navigation';
import { auth } from '@/auth';
import { buildApiHeaders, apiBase } from '@/lib/server-api';
import { hasPermission } from '@/lib/permissions';
import { ApplicationStatusForm } from '../application-status-form';
import { EnrollStudentButton } from '../enroll-student-button';

const primary = '#1e3a5f';
const muted = '#64748b';

type ApplicationDetail = {
  id: string;
  status: string;
  personalStatement: string | null;
  documents: unknown;
  reviewNotes: unknown;
  reviewedAt: string | null;
  acceptedStudentId: string | null;
  createdAt: string;
  cycle: { id: string; name: string };
  program: { id: string; code: string; name: string };
  applicant: {
    id: string;
    email: string;
    profile?: { firstName?: string; lastName?: string } | null;
  };
  reviewer?: { email: string } | null;
  student?: { id: string; studentNumber: string } | null;
};

export default async function ApplicationDetailPage({
  params,
}: {
  params: Promise<{ applicationId: string }>;
}) {
  const { applicationId } = await params;
  const session = await auth();

  if (!session?.accessToken) {
    return (
      <main style={{ padding: '2rem' }}>
        <Link href="/login">Sign in</Link>
      </main>
    );
  }

  const res = await fetch(
    `${apiBase}/admissions/applications/${encodeURIComponent(applicationId)}`,
    {
      headers: buildApiHeaders(session),
      cache: 'no-store',
    },
  );

  if (res.status === 404) {
    notFound();
  }
  if (!res.ok) {
    return (
      <main style={{ padding: '2rem' }}>
        <p style={{ color: '#b91c1c' }}>Could not load application ({res.status}).</p>
        <Link href="/dashboard/admissions">← Admissions</Link>
      </main>
    );
  }

  const app = (await res.json()) as ApplicationDetail;
  const canWrite = hasPermission(session.user.permissions, 'admissions.write');
  const name =
    app.applicant.profile?.firstName || app.applicant.profile?.lastName
      ? [app.applicant.profile.firstName, app.applicant.profile.lastName].filter(Boolean).join(' ')
      : app.applicant.email;

  return (
    <main
      style={{
        padding: '2rem 1.5rem',
        maxWidth: 720,
        margin: '0 auto',
        fontFamily: '"IBM Plex Sans", system-ui',
      }}
    >
      <Link href="/dashboard/admissions" style={{ color: primary }}>
        ← Admissions
      </Link>
      <h1
        style={{ fontFamily: '"Crimson Pro", Georgia, serif', color: primary, marginTop: '1rem' }}
      >
        {name}
      </h1>
      <p style={{ color: muted, fontSize: '0.9rem' }}>
        {app.program.code} — {app.program.name} · {app.cycle.name}
      </p>

      <section style={{ marginTop: '1.5rem' }}>
        <h2 style={{ fontSize: '1rem', color: primary }}>Decision</h2>
        <ApplicationStatusForm
          applicationId={app.id}
          currentStatus={app.status}
          canWrite={canWrite}
        />
        <EnrollStudentButton
          applicationId={app.id}
          canWrite={canWrite}
          hasStudent={Boolean(app.student)}
          acceptedStatus={app.status === 'ACCEPTED'}
        />
        {app.status === 'ACCEPTED' ? (
          <p
            style={{
              marginTop: '0.75rem',
              fontSize: '0.9rem',
              display: 'flex',
              gap: '0.85rem',
              flexWrap: 'wrap',
            }}
          >
            <a
              href={`/dashboard/admissions/${app.id}/offer-letter`}
              target="_blank"
              rel="noreferrer"
              style={{ color: primary, fontWeight: 600 }}
            >
              Offer letter (HTML)
            </a>
            <a
              href={`/dashboard/admissions/${app.id}/offer-letter/pdf`}
              target="_blank"
              rel="noreferrer"
              style={{ color: primary, fontWeight: 600 }}
            >
              Download PDF
            </a>
          </p>
        ) : null}
        {app.student ? (
          <p style={{ marginTop: '0.75rem', fontSize: '0.9rem' }}>
            Linked student:{' '}
            <Link href={`/dashboard/students/${app.student.id}`} style={{ color: primary }}>
              {app.student.studentNumber}
            </Link>
          </p>
        ) : null}
        {app.reviewedAt ? (
          <p style={{ color: muted, fontSize: '0.85rem', marginTop: '0.5rem' }}>
            Reviewed {new Date(app.reviewedAt).toLocaleString()}
            {app.reviewer ? ` by ${app.reviewer.email}` : ''}
          </p>
        ) : null}
      </section>

      {app.personalStatement ? (
        <section style={{ marginTop: '1.5rem' }}>
          <h2 style={{ fontSize: '1rem', color: primary }}>Personal statement</h2>
          <p style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{app.personalStatement}</p>
        </section>
      ) : null}

      <section style={{ marginTop: '1.5rem' }}>
        <h2 style={{ fontSize: '1rem', color: primary }}>Documents</h2>
        <pre
          style={{
            background: '#f8fafc',
            padding: '1rem',
            borderRadius: 8,
            fontSize: '0.8rem',
            overflow: 'auto',
          }}
        >
          {JSON.stringify(app.documents, null, 2)}
        </pre>
      </section>

      {app.reviewNotes && Object.keys(app.reviewNotes as object).length > 0 ? (
        <section style={{ marginTop: '1.5rem' }}>
          <h2 style={{ fontSize: '1rem', color: primary }}>Review notes</h2>
          <pre
            style={{ background: '#f8fafc', padding: '1rem', borderRadius: 8, fontSize: '0.8rem' }}
          >
            {JSON.stringify(app.reviewNotes, null, 2)}
          </pre>
        </section>
      ) : null}
    </main>
  );
}
