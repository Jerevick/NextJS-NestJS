import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { auth } from '@/auth';
import styles from '../registration-requests.module.css';
import { ReviewActions } from '../review-actions';
import type {
  RegistrationRequestDetail,
  RegistrationRequestPayload,
  RegistrationRequestStatus,
} from '../types';

const apiBase =
  process.env.AUTH_API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
const webPublicBase = (
  process.env.WEB_PUBLIC_URL ??
  process.env.NEXT_PUBLIC_WEB_URL ??
  process.env.NEXTAUTH_URL ??
  'http://localhost:3000'
).replace(/\/$/, '');

export const metadata: Metadata = {
  title: 'Registration request — UniCore',
};

function statusBadgeClass(status: RegistrationRequestStatus): string {
  if (status === 'PROVISIONED') return styles.statusProvisioned;
  if (status === 'REVIEWED') return styles.statusReviewed;
  if (status === 'DISMISSED') return styles.statusDismissed;
  return styles.statusPending;
}

function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

function formatAddress(payload: RegistrationRequestPayload): string {
  const a = payload.address;
  if (!a) return payload.country ?? '—';
  const parts = [
    a.line1,
    a.line2,
    [a.city, a.stateProvince].filter(Boolean).join(', '),
    [a.postalCode, a.country].filter(Boolean).join(' · '),
  ].filter(Boolean);
  return parts.join('\n');
}

function documentHref(requestId: string, document: 'logo' | 'accreditationEvidence'): string {
  return `/dashboard/admin/registration-requests/${encodeURIComponent(requestId)}/documents/${document}`;
}

function trackerPath(requestId: string): string {
  return `/register?reference=${encodeURIComponent(requestId)}`;
}

function trackerUrl(requestId: string): string {
  return `${webPublicBase}${trackerPath(requestId)}`;
}

function trackerEmailHref(args: {
  email?: string | null;
  institutionName?: string | null;
  reference: string;
  url: string;
}): string | null {
  if (!args.email?.trim()) {
    return null;
  }
  const institution = args.institutionName?.trim() || 'your institution';
  const subject = `UniCore registration reference for ${institution}`;
  const body = [
    'Hello,',
    '',
    `Your UniCore registration reference is: ${args.reference}`,
    `You can track your onboarding request here: ${args.url}`,
    '',
    'Regards,',
    'The UniCore platform team',
  ].join('\n');
  return `mailto:${encodeURIComponent(args.email.trim())}?subject=${encodeURIComponent(
    subject,
  )}&body=${encodeURIComponent(body)}`;
}

export default async function RegistrationRequestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();

  if (!session?.accessToken || !session.user) {
    redirect(`/login?callbackUrl=/dashboard/admin/registration-requests/${encodeURIComponent(id)}`);
  }

  if (!session.user.permissions?.includes('*')) {
    return (
      <main className={styles.page}>
        <Link href="/dashboard/admin/registration-requests" className={styles.breadcrumb}>
          ← Registration requests
        </Link>
        <h1 className={styles.title}>Registration request</h1>
        <p className={styles.subtitle} style={{ color: '#b91c1c' }}>
          Platform super administrator access required.
        </p>
      </main>
    );
  }

  const res = await fetch(
    `${apiBase}/super-admin/registration-requests/${encodeURIComponent(id)}`,
    {
      headers: { Authorization: `Bearer ${session.accessToken}` },
      cache: 'no-store',
    },
  );

  if (res.status === 404) {
    notFound();
  }
  if (res.status === 401) {
    redirect(`/login?callbackUrl=/dashboard/admin/registration-requests/${encodeURIComponent(id)}`);
  }
  if (!res.ok) {
    return (
      <main className={styles.page}>
        <Link href="/dashboard/admin/registration-requests" className={styles.breadcrumb}>
          ← Registration requests
        </Link>
        <h1 className={styles.title}>Registration request</h1>
        <p className={styles.subtitle} style={{ color: '#b91c1c' }}>
          Failed to load request (HTTP {res.status}).
        </p>
      </main>
    );
  }

  const row = (await res.json()) as RegistrationRequestDetail;
  const payload = row.payload ?? {};
  const accreditation = payload.accreditation ?? {};
  const contact = payload.contact ?? {};
  const publicTrackerPath = trackerPath(row.id);
  const publicTrackerUrl = trackerUrl(row.id);
  const trackerEmail = trackerEmailHref({
    email: contact.email ?? row.email,
    institutionName: payload.institutionName,
    reference: row.id,
    url: publicTrackerUrl,
  });

  return (
    <main className={styles.page}>
      <Link href="/dashboard/admin/registration-requests" className={styles.breadcrumb}>
        ← Registration requests
      </Link>

      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Onboarding dossier</p>
          <h1 className={styles.title}>{payload.institutionName ?? 'Untitled institution'}</h1>
          <p className={styles.subtitle}>
            Reference <span className={styles.detailMeta}>{row.id}</span>
            {' · '}
            Submitted {formatDate(row.createdAt)}
          </p>
        </div>
        <span className={`${styles.statusBadge} ${statusBadgeClass(row.status)}`}>
          {row.status}
        </span>
      </header>

      <div className={styles.detailGrid}>
        <div className={styles.detailColumn}>
          <section className={styles.detailCard}>
            <h2 className={styles.detailCardTitle}>Institution</h2>
            <dl className={styles.fieldList}>
              <Field label="Legal name" value={payload.institutionName} />
              <Field label="Type" value={payload.institutionType} />
              <Field label="Official email" value={payload.institutionEmail} />
              <Field label="Estimated students" value={payload.estimatedStudents} />
            </dl>
          </section>

          <section className={styles.detailCard}>
            <h2 className={styles.detailCardTitle}>Registered address</h2>
            <dl className={styles.fieldList}>
              <Field label="Country" value={payload.address?.country ?? payload.country} />
              <Field label="State / province" value={payload.address?.stateProvince} />
              <Field label="City" value={payload.address?.city} />
              <Field label="Postal code" value={payload.address?.postalCode} />
              <Field label="Street" value={formatAddress(payload)} multiline />
            </dl>
          </section>

          <section className={styles.detailCard}>
            <h2 className={styles.detailCardTitle}>Accreditation</h2>
            <dl className={styles.fieldList}>
              <Field label="Status" value={accreditation.status} />
              <Field label="Body" value={accreditation.body} />
              <Field label="Reference" value={accreditation.reference} />
              <Field label="Valid until" value={accreditation.validUntil} />
            </dl>
          </section>

          <section className={styles.detailCard}>
            <h2 className={styles.detailCardTitle}>Authorized representative</h2>
            <dl className={styles.fieldList}>
              <Field
                label="Name"
                value={
                  contact.fullName ??
                  [contact.firstName, contact.lastName].filter(Boolean).join(' ')
                }
              />
              <Field label="Job title" value={contact.title} />
              <Field label="Phone" value={contact.phone} />
              <Field label="Email" value={contact.email ?? row.email} />
            </dl>
          </section>

          {payload.message ? (
            <section className={styles.detailCard}>
              <h2 className={styles.detailCardTitle}>Additional notes</h2>
              <p className={styles.notes}>{payload.message}</p>
            </section>
          ) : null}
        </div>

        <div className={styles.detailColumn}>
          <section className={styles.detailCard}>
            <h2 className={styles.detailCardTitle}>Review</h2>
            <ReviewActions requestId={row.id} status={row.status} />
            {row.reviewedAt ? (
              <p className={styles.reviewedNote} style={{ marginTop: '0.6rem' }}>
                Last reviewed {formatDate(row.reviewedAt)}.
              </p>
            ) : null}
          </section>

          <section className={styles.detailCard}>
            <h2 className={styles.detailCardTitle}>Registrant tracker</h2>
            <p className={styles.trackerHelpText}>
              Share this reference or link when the registrant misplaces their onboarding tracker.
            </p>
            <div className={styles.trackerReferenceBox}>
              <span className={styles.trackerReferenceLabel}>Reference ID</span>
              <code className={styles.trackerReferenceCode}>{row.id}</code>
            </div>
            <div className={styles.trackerActions}>
              <a
                className={styles.documentLink}
                href={publicTrackerPath}
                target="_blank"
                rel="noreferrer noopener"
              >
                Open public tracker ↗
              </a>
              {trackerEmail ? (
                <a className={styles.documentLink} href={trackerEmail}>
                  Email reference
                </a>
              ) : null}
            </div>
            <p className={styles.trackerUrlText}>{publicTrackerUrl}</p>
          </section>

          <section className={styles.detailCard}>
            <h2 className={styles.detailCardTitle}>Documents</h2>
            <div style={{ display: 'grid', gap: '0.5rem' }}>
              {row.documents?.logoUrl ? (
                <a
                  className={styles.documentLink}
                  href={documentHref(row.id, 'logo')}
                  target="_blank"
                  rel="noreferrer noopener"
                >
                  View institution logo{payload.logoFileName ? ` (${payload.logoFileName})` : ''} ↗
                </a>
              ) : (
                <p className={styles.reviewedNote}>No logo uploaded.</p>
              )}
              {row.documents?.accreditationEvidenceUrl ? (
                <a
                  className={styles.documentLink}
                  href={documentHref(row.id, 'accreditationEvidence')}
                  target="_blank"
                  rel="noreferrer noopener"
                >
                  View accreditation evidence
                  {payload.accreditationEvidenceFileName
                    ? ` (${payload.accreditationEvidenceFileName})`
                    : ''}{' '}
                  ↗
                </a>
              ) : (
                <p className={styles.reviewedNote}>No accreditation evidence on file.</p>
              )}
            </div>
          </section>

          <section className={styles.detailCard}>
            <h2 className={styles.detailCardTitle}>Modules requested</h2>
            <div className={styles.modulesRow}>
              {(payload.corePackages ?? []).map((mod) => (
                <span key={mod} className={styles.modulePill}>
                  {mod}
                </span>
              ))}
              {(!payload.corePackages || payload.corePackages.length === 0) && (
                <p className={styles.reviewedNote}>No core packages selected.</p>
              )}
            </div>
            {payload.sisLmsBridgeRequested ? (
              <p className={styles.reviewedNote} style={{ marginTop: '0.55rem' }}>
                SIS ↔ LMS bridge requested.
              </p>
            ) : null}
          </section>

          <section className={styles.detailCard}>
            <h2 className={styles.detailCardTitle}>Submission metadata</h2>
            <dl className={styles.fieldList}>
              <Field label="IP address" value={row.ipAddress} />
              <Field label="User agent" value={row.userAgent} multiline />
              <Field label="Reviewed at" value={formatDate(row.reviewedAt)} />
            </dl>
          </section>
        </div>
      </div>
    </main>
  );
}

function Field({
  label,
  value,
  multiline,
}: {
  label: string;
  value?: string | null;
  multiline?: boolean;
}) {
  const display = value && value.toString().trim() ? value : '—';
  return (
    <div className={styles.fieldRow}>
      <dt className={styles.fieldLabel}>{label}</dt>
      <dd className={styles.fieldValue} style={multiline ? { whiteSpace: 'pre-line' } : undefined}>
        {display}
      </dd>
    </div>
  );
}
