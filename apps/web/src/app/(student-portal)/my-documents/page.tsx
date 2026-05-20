import Link from 'next/link';
import { auth } from '@/auth';
import { DocumentRequestWizard } from '@/components/student-portal/document-request-wizard';
import { StudentPortalPageHeader } from '@/components/student-portal/student-portal-page-header';
import { STUDENT_PORTAL } from '@/components/student-portal/student-portal-styles';
import { fetchPortalJson } from '@/lib/portal-api';

type DocsPayload = {
  data: Array<{
    id: string;
    type: string;
    title: string;
    status: string;
    requestedAt: string | null;
    issuedAt: string | null;
    expiresAt: string | null;
    hasFile: boolean;
    verificationCode: string | null;
    downloadable: boolean;
  }>;
  issued: DocsPayload['data'];
  pending: DocsPayload['data'];
};

function DocumentList({ items, emptyLabel }: { items: DocsPayload['data']; emptyLabel: string }) {
  if (items.length === 0) {
    return <p style={{ color: STUDENT_PORTAL.muted, fontSize: '0.9rem' }}>{emptyLabel}</p>;
  }
  return (
    <ul style={{ listStyle: 'none', padding: 0, margin: '0.65rem 0 0' }}>
      {items.map((doc) => (
        <li
          key={doc.id}
          style={{
            padding: '1rem 1.15rem',
            background: '#fff',
            border: `1px solid ${STUDENT_PORTAL.border}`,
            borderRadius: 10,
            marginBottom: 10,
          }}
        >
          <div style={{ fontWeight: 600 }}>{doc.title}</div>
          <div style={{ fontSize: '0.85rem', color: STUDENT_PORTAL.muted, marginTop: 4 }}>
            {doc.type} · {doc.status}
            {doc.requestedAt ? ` · Requested ${doc.requestedAt.slice(0, 10)}` : null}
            {doc.issuedAt ? ` · Issued ${doc.issuedAt.slice(0, 10)}` : null}
          </div>
          {doc.verificationCode ? (
            <div style={{ fontSize: '0.82rem', marginTop: 6 }}>
              Verification: <code>{doc.verificationCode}</code>
            </div>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

export default async function MyDocumentsPage() {
  const session = await auth();
  if (!session?.accessToken) {
    return null;
  }

  const [docsRes, profileRes] = await Promise.all([
    fetchPortalJson<DocsPayload>('/portal/student/documents', session),
    fetchPortalJson<{ readOnly: boolean }>('/portal/student/profile', session),
  ]);

  const readOnly = profileRes.ok ? profileRes.data.readOnly : false;

  return (
    <div style={{ padding: '2rem 2.5rem', maxWidth: 800 }}>
      <StudentPortalPageHeader
        title="My documents"
        description="Download issued documents or request new ones from the registrar."
      />

      <DocumentRequestWizard readOnly={readOnly} />

      {!docsRes.ok ? (
        <p style={{ color: '#b91c1c', marginTop: '1rem' }}>
          Could not load documents ({docsRes.status}).
        </p>
      ) : (
        <>
          <section style={{ marginTop: '2rem' }}>
            <h2 style={{ fontSize: '1.05rem', color: STUDENT_PORTAL.text }}>Pending requests</h2>
            <DocumentList items={docsRes.data.pending} emptyLabel="No pending document requests." />
          </section>

          <section style={{ marginTop: '2rem' }}>
            <h2 style={{ fontSize: '1.05rem', color: STUDENT_PORTAL.text }}>Issued documents</h2>
            <DocumentList items={docsRes.data.issued} emptyLabel="No issued documents yet." />
          </section>
        </>
      )}

      <p style={{ marginTop: '1.5rem' }}>
        <Link href="/workflow/inbox" style={{ color: STUDENT_PORTAL.teal, fontWeight: 600 }}>
          Track requests in workflow inbox →
        </Link>
      </p>
    </div>
  );
}
