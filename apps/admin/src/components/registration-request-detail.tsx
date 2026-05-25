import Link from 'next/link';
import type { CSSProperties, ReactNode } from 'react';
import { RegistrationRequestRowActions } from '@/components/registration-request-row-actions';
import {
  formatAccreditationLabel,
  type NewInstitutionPayload,
  type RegistrationRequestRow,
} from '@/lib/registration-request.util';

const webPublicBase = (
  process.env.WEB_PUBLIC_URL ??
  process.env.NEXT_PUBLIC_WEB_URL ??
  process.env.NEXTAUTH_URL ??
  'http://localhost:3000'
).replace(/\/$/, '');

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

export function RegistrationRequestDetail({ row }: { row: RegistrationRequestRow }) {
  if (row.kind !== 'NEW_INSTITUTION') {
    return (
      <div style={{ fontSize: '0.9rem', color: '#94a3b8' }}>
        <p>Join request — review in institution console.</p>
        <pre style={detailPre}>{JSON.stringify(row.payload, null, 2)}</pre>
      </div>
    );
  }

  const p = row.payload as NewInstitutionPayload;
  const canProvision = row.status === 'REVIEWED';
  const publicTrackerUrl = trackerUrl(row.id);
  const trackerEmail = trackerEmailHref({
    email: p.contact?.email ?? row.email,
    institutionName: p.institutionName,
    reference: row.id,
    url: publicTrackerUrl,
  });

  return (
    <div style={{ display: 'grid', gap: '1.5rem' }}>
      <div style={headerRow}>
        <div>
          <h1 style={{ margin: '0 0 0.35rem', fontSize: '1.25rem' }}>{p.institutionName}</h1>
          <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.9rem' }}>
            {row.status} · submitted {new Date(row.createdAt).toLocaleString()}
          </p>
        </div>
        <RegistrationRequestRowActions requestId={row.id} canProvision={canProvision} />
      </div>

      <div style={grid}>
        <DetailCard title="Institution">
          <DetailRow label="Legal name" value={p.institutionName} />
          <DetailRow label="Type" value={p.institutionType} />
          <DetailRow label="Institutional email" value={p.institutionEmail} />
          {row.documents?.logoUrl ? (
            <div style={{ marginTop: '0.75rem' }}>
              <span style={labelStyle}>Logo</span>
              <div style={{ marginTop: 6 }}>
                <img
                  src={row.documents.logoUrl}
                  alt="Institution logo"
                  style={{ maxHeight: 80, maxWidth: 200, borderRadius: 8, background: '#0f172a' }}
                />
              </div>
              <a href={row.documents.logoUrl} target="_blank" rel="noreferrer" style={linkStyle}>
                Open logo file
              </a>
            </div>
          ) : (
            <DetailRow label="Logo" value={p.logoFileName} />
          )}
        </DetailCard>

        <DetailCard title="Registrant tracker">
          <DetailRow label="Reference ID" value={row.id} />
          <DetailRow label="Tracker link" value={publicTrackerUrl} />
          <p style={{ margin: '0.75rem 0 0', color: '#94a3b8', fontSize: '0.82rem' }}>
            Share this reference or link if the registrant misplaces their onboarding tracker.
          </p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
            <Link href={trackerPath(row.id)} target="_blank" style={trackerLink}>
              Open tracker →
            </Link>
            {trackerEmail ? (
              <a href={trackerEmail} style={trackerLink}>
                Email reference
              </a>
            ) : null}
          </div>
        </DetailCard>

        <DetailCard title="Address">
          {p.address ? (
            <pre style={{ ...detailPre, margin: 0 }}>
              {[
                p.address.line1,
                p.address.line2,
                [p.address.city, p.address.stateProvince, p.address.postalCode]
                  .filter(Boolean)
                  .join(', '),
                p.address.country,
              ]
                .filter(Boolean)
                .join('\n')}
            </pre>
          ) : (
            <DetailRow label="Country" value={p.country} />
          )}
        </DetailCard>

        <DetailCard title="Accreditation">
          <DetailRow label="Status" value={formatAccreditationLabel(p.accreditation?.status)} />
          <DetailRow label="Body" value={p.accreditation?.body} />
          <DetailRow label="Reference" value={p.accreditation?.reference} />
          <DetailRow label="Valid until" value={p.accreditation?.validUntil} />
          {row.documents?.accreditationEvidenceUrl ? (
            <a
              href={row.documents.accreditationEvidenceUrl}
              target="_blank"
              rel="noreferrer"
              style={{ ...linkStyle, display: 'inline-block', marginTop: 8 }}
            >
              View accreditation evidence ({p.accreditationEvidenceFileName ?? 'document'})
            </a>
          ) : (
            <DetailRow label="Evidence file" value={p.accreditationEvidenceFileName} />
          )}
        </DetailCard>

        <DetailCard title="Contact person">
          <DetailRow
            label="Name"
            value={
              p.contact?.fullName ??
              [p.contact?.firstName, p.contact?.lastName].filter(Boolean).join(' ')
            }
          />
          <DetailRow label="Title" value={p.contact?.title} />
          <DetailRow label="Phone" value={p.contact?.phone} />
          <DetailRow label="Email" value={p.contact?.email ?? row.email} />
        </DetailCard>

        <DetailCard title="Operations">
          <DetailRow label="Est. students" value={p.estimatedStudents} />
          <DetailRow label="Core packages" value={p.corePackages?.join(', ')} />
          <DetailRow
            label="Modules on provision"
            value={
              Array.isArray(p.modulesEffective)
                ? (p.modulesEffective as string[]).join(', ')
                : undefined
            }
          />
          {p.message ? (
            <div style={{ marginTop: 8 }}>
              <span style={labelStyle}>Message</span>
              <p style={{ margin: '4px 0 0', color: '#e2e8f0', whiteSpace: 'pre-wrap' }}>
                {p.message}
              </p>
            </div>
          ) : null}
        </DetailCard>
      </div>

      {canProvision ? (
        <Link
          href={`/institutions/new?requestId=${encodeURIComponent(row.id)}`}
          style={provisionLink}
        >
          Open provision wizard →
        </Link>
      ) : null}
    </div>
  );
}

function DetailCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section style={card}>
      <h2 style={{ margin: '0 0 0.75rem', fontSize: '0.95rem', color: '#e2e8f0' }}>{title}</h2>
      {children}
    </section>
  );
}

function DetailRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div style={{ marginBottom: 6 }}>
      <span style={labelStyle}>{label}</span>
      <div style={{ color: '#cbd5e1', fontSize: '0.88rem' }}>{value}</div>
    </div>
  );
}

const headerRow: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  gap: '1rem',
  flexWrap: 'wrap',
};

const grid: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
  gap: '1rem',
};

const card: CSSProperties = {
  padding: '1rem',
  borderRadius: 8,
  border: '1px solid #334155',
  background: '#111827',
};

const labelStyle: CSSProperties = {
  display: 'block',
  fontSize: '0.75rem',
  color: '#64748b',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
};

const linkStyle: CSSProperties = {
  color: '#60a5fa',
  fontSize: '0.85rem',
};

const provisionLink: CSSProperties = {
  display: 'inline-block',
  padding: '0.6rem 1rem',
  borderRadius: 6,
  background: '#2563eb',
  color: '#fff',
  textDecoration: 'none',
  fontWeight: 600,
  width: 'fit-content',
};

const trackerLink: CSSProperties = {
  display: 'inline-block',
  padding: '0.4rem 0.7rem',
  borderRadius: 6,
  border: '1px solid #334155',
  color: '#60a5fa',
  textDecoration: 'none',
  fontSize: '0.82rem',
  fontWeight: 600,
};

const detailPre: CSSProperties = {
  padding: '0.65rem',
  borderRadius: 6,
  background: '#0f172a',
  color: '#cbd5e1',
  fontSize: '0.8rem',
  overflow: 'auto',
};
