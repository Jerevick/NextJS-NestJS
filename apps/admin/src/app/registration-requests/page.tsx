import Link from 'next/link';
import type { ReactNode } from 'react';
import {
  RegistrationRequestsDataGrid,
  type RegistrationRequestGridRow,
} from '@/components/data-grids/institutions-data-grid';
import { getRegistrationRequests } from '@/lib/platform-api';
import {
  registrationRequestSummary,
  type RegistrationRequestRow,
} from '@/lib/registration-request.util';

export default async function RegistrationRequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; kind?: string }>;
}) {
  const params = await searchParams;
  const status = params.status ?? 'PENDING';
  const res = await getRegistrationRequests({ status, limit: 100 });
  const rows: RegistrationRequestRow[] = Array.isArray(res.data)
    ? (res.data as RegistrationRequestRow[])
    : [];

  return (
    <main style={{ padding: '2rem' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
        }}
      >
        <h1 style={{ fontSize: '1.25rem', marginTop: 0 }}>Registration requests</h1>
        <Link
          href="/institutions/new"
          style={{
            padding: '0.45rem 0.85rem',
            borderRadius: 6,
            background: '#2563eb',
            color: '#fff',
            textDecoration: 'none',
            fontSize: '0.85rem',
            fontWeight: 600,
          }}
        >
          Onboard manually
        </Link>
      </div>

      <p style={{ color: '#94a3b8', fontSize: '0.9rem' }}>
        Source: <strong>{res.mode}</strong>
        {res.mode === 'error' && 'message' in res ? ` · ${String(res.message)}` : null}
      </p>

      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <FilterLink href="/registration-requests?status=PENDING" active={status === 'PENDING'}>
          Pending
        </FilterLink>
        <FilterLink href="/registration-requests?status=REVIEWED" active={status === 'REVIEWED'}>
          Reviewed
        </FilterLink>
        <FilterLink
          href="/registration-requests?status=PROVISIONED"
          active={status === 'PROVISIONED'}
        >
          Provisioned
        </FilterLink>
        <FilterLink href="/registration-requests?status=DISMISSED" active={status === 'DISMISSED'}>
          Dismissed
        </FilterLink>
      </div>

      {rows.length === 0 ? (
        <p style={{ color: '#64748b', marginTop: '1.5rem' }}>No {status.toLowerCase()} requests.</p>
      ) : (
        <RegistrationRequestsDataGrid
          rows={rows.map(
            (r): RegistrationRequestGridRow => ({
              id: r.id,
              kind: r.kind === 'NEW_INSTITUTION' ? 'New tenant' : 'Join',
              status: r.status,
              email: r.email,
              summary: registrationRequestSummary(r),
              institutionSlug: r.institutionSlug ?? r.institution?.slug ?? '—',
              createdAt: r.createdAt,
              canProvision: r.kind === 'NEW_INSTITUTION' && r.status === 'REVIEWED',
            }),
          )}
        />
      )}
    </main>
  );
}

function FilterLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      style={{
        padding: '0.35rem 0.75rem',
        borderRadius: 999,
        fontSize: '0.82rem',
        fontWeight: 600,
        textDecoration: 'none',
        background: active ? '#2563eb' : '#1e293b',
        color: active ? '#fff' : '#94a3b8',
        border: `1px solid ${active ? '#2563eb' : '#334155'}`,
      }}
    >
      {children}
    </Link>
  );
}
