import Link from 'next/link';
import { env } from '@/env';
import { getRegistrationRequest } from '@/lib/platform-api';
import {
  provisionDefaultsFromRequest,
  registrationRequestSummary,
  type RegistrationRequestRow,
} from '@/lib/registration-request.util';
import { ProvisionInstitutionForm } from './provision-form';

export default async function NewInstitutionPage({
  searchParams,
}: {
  searchParams: Promise<{ requestId?: string }>;
}) {
  const params = await searchParams;
  const requestId = params.requestId?.trim();

  let request: RegistrationRequestRow | null = null;
  if (requestId && env.ADMIN_API_BEARER) {
    const res = await getRegistrationRequest(requestId);
    if (res.mode === 'live' && res.found) {
      request = res.request as RegistrationRequestRow;
    }
  }

  const defaults = request ? provisionDefaultsFromRequest(request) : null;
  const isJoinRequest = request?.kind === 'JOIN_INSTITUTION';

  return (
    <main style={{ padding: '2rem', maxWidth: 640 }}>
      <p style={{ marginTop: 0 }}>
        <Link href="/institutions" style={{ color: '#60a5fa' }}>
          ← Institutions
        </Link>
        {requestId ? (
          <>
            {' · '}
            <Link href="/registration-requests" style={{ color: '#60a5fa' }}>
              Registration requests
            </Link>
          </>
        ) : null}
      </p>

      <h1 style={{ fontSize: '1.25rem', marginTop: 0 }}>Onboard institution</h1>
      <p style={{ color: '#94a3b8', fontSize: '0.9rem' }}>
        Creates the tenant, MAIN_CAMPUS entity (provisioned), subscription, and institution admin
        user.
      </p>

      {request ? (
        <div
          style={{
            marginBottom: '1.25rem',
            padding: '1rem',
            borderRadius: 8,
            border: '1px solid #334155',
            background: '#111827',
            fontSize: '0.88rem',
          }}
        >
          <p style={{ margin: '0 0 0.35rem', color: '#e2e8f0', fontWeight: 600 }}>
            Linked request · {request.status}
          </p>
          <p style={{ margin: 0, color: '#94a3b8' }}>{registrationRequestSummary(request)}</p>
          {defaults?.logoUrl ? (
            <div style={{ marginTop: '0.75rem' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={defaults.logoUrl}
                alt="Submitted logo"
                style={{ maxHeight: 64, borderRadius: 8, background: '#0f172a' }}
              />
            </div>
          ) : null}
          <p style={{ margin: '0.75rem 0 0' }}>
            <Link href={`/registration-requests/${request.id}`} style={{ color: '#60a5fa' }}>
              View full intake →
            </Link>
          </p>
          {isJoinRequest ? (
            <p style={{ margin: '0.75rem 0 0', color: '#fbbf24' }}>
              This is a join request — provision a user through the institution console instead. You
              can mark it reviewed from{' '}
              <Link href="/registration-requests" style={{ color: '#60a5fa' }}>
                registration requests
              </Link>
              .
            </p>
          ) : defaults?.notes ? (
            <pre
              style={{
                margin: '0.75rem 0 0',
                padding: '0.65rem',
                borderRadius: 6,
                background: '#0f172a',
                color: '#cbd5e1',
                fontSize: '0.8rem',
                whiteSpace: 'pre-wrap',
              }}
            >
              {defaults.notes}
            </pre>
          ) : null}
        </div>
      ) : null}

      {isJoinRequest ? null : (
        <ProvisionInstitutionForm
          bearerConfigured={Boolean(env.ADMIN_API_BEARER)}
          registrationRequestId={request?.kind === 'NEW_INSTITUTION' ? request.id : undefined}
          initialValues={
            defaults
              ? {
                  slug: defaults.slug,
                  name: defaults.name,
                  adminEmail: defaults.adminEmail,
                  adminFirstName: defaults.adminFirstName,
                  adminLastName: defaults.adminLastName,
                }
              : undefined
          }
        />
      )}
    </main>
  );
}
