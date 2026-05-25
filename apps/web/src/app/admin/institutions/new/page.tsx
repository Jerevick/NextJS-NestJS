import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { auth } from '@/auth';
import {
  resolveModulesFromCoreSelection,
  type CorePackageId,
  type TenantModuleId,
} from '@/lib/unicore-module-catalog';
import type {
  RegistrationRequestDetail,
  RegistrationRequestPayload,
} from '../../registration-requests/types';
import {
  ProvisionInstitutionForm,
  ProvisioningSuccessToast,
  type ProvisionInitialValues,
} from './provision-institution-form';
import styles from './provisioning.module.css';

const apiBase =
  process.env.AUTH_API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export const metadata: Metadata = {
  title: 'Provision institution — UniCore',
};

type SearchParams = {
  requestId?: string;
  institutionId?: string;
  slug?: string;
};

function domainFromEmail(email?: string | null): string {
  const domain = email?.split('@')[1]?.trim().toLowerCase();
  return domain && !['gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com'].includes(domain)
    ? domain
    : '';
}

function fullNameParts(payload: RegistrationRequestPayload): {
  firstName: string;
  lastName: string;
} {
  const contact = payload.contact;
  const fullName =
    contact?.fullName?.trim() ||
    [contact?.firstName, contact?.lastName].filter(Boolean).join(' ').trim();
  const parts = fullName.split(/\s+/).filter(Boolean);
  return {
    firstName: contact?.firstName?.trim() || parts[0] || '',
    lastName: contact?.lastName?.trim() || (parts.length > 1 ? parts.slice(1).join(' ') : ''),
  };
}

function parseStudentCount(value?: string | null): string {
  if (value === '500-2000') {
    return '2000';
  }
  if (value === '2000-10000' || value === '10000-plus') {
    return '10000';
  }
  return '500';
}

function planFromStudentRange(value?: string | null): ProvisionInitialValues['plan'] {
  if (value === '500-2000') {
    return 'GROWTH';
  }
  if (value === '2000-10000' || value === '10000-plus') {
    return 'ENTERPRISE';
  }
  return 'STARTER';
}

function modulesFromPayload(payload: RegistrationRequestPayload): TenantModuleId[] {
  const core = (payload.corePackages ?? []).filter(
    (id): id is CorePackageId => id === 'SIS' || id === 'LMS',
  );
  if (core.length > 0) {
    return resolveModulesFromCoreSelection(core);
  }

  const fromEffective = (payload.modulesEffective ?? []).filter((id): id is TenantModuleId =>
    ['SIS', 'LMS', 'FINANCE', 'HR', 'ELECTIONS', 'ALUMNI', 'SPORTS', 'MEETINGS'].includes(id),
  );
  if (fromEffective.length > 0) {
    const effectiveCore = fromEffective.filter(
      (id): id is CorePackageId => id === 'SIS' || id === 'LMS',
    );
    return resolveModulesFromCoreSelection(
      effectiveCore.length > 0 ? effectiveCore : ['SIS', 'LMS'],
    );
  }

  return resolveModulesFromCoreSelection(['SIS', 'LMS']);
}

function notesFromPayload(payload: RegistrationRequestPayload): string {
  const address = payload.address
    ? [
        payload.address.line1,
        payload.address.line2,
        [payload.address.city, payload.address.stateProvince, payload.address.postalCode]
          .filter(Boolean)
          .join(', '),
        payload.address.country,
      ]
        .filter(Boolean)
        .join('\n')
    : payload.country;

  return [
    payload.institutionType ? `Type: ${payload.institutionType}` : null,
    payload.institutionEmail ? `Institution email: ${payload.institutionEmail}` : null,
    address ? `Address:\n${address}` : null,
    payload.accreditation?.status ? `Accreditation: ${payload.accreditation.status}` : null,
    payload.accreditation?.body ? `Accrediting body: ${payload.accreditation.body}` : null,
    payload.accreditation?.reference
      ? `Accreditation reference: ${payload.accreditation.reference}`
      : null,
    payload.contact?.phone ? `Contact phone: ${payload.contact.phone}` : null,
    payload.message ? `Registrant notes: ${payload.message}` : null,
  ]
    .filter(Boolean)
    .join('\n');
}

function defaultsFromRequest(row: RegistrationRequestDetail | null): ProvisionInitialValues {
  const payload = row?.payload ?? {};
  const institutionName = payload.institutionName?.trim() || '';
  const names = fullNameParts(payload);
  const maxStudents = parseStudentCount(payload.estimatedStudents);

  return {
    registrationRequestId: row?.kind === 'NEW_INSTITUTION' ? row.id : undefined,
    lockedFromRegistration: row?.kind === 'NEW_INSTITUTION',
    name: institutionName,
    domain: domainFromEmail(payload.institutionEmail),
    plan:
      row?.kind === 'NEW_INSTITUTION' ? planFromStudentRange(payload.estimatedStudents) : 'STARTER',
    maxStudents,
    billingDayOfMonth: '1',
    disputeWindowDays: '14',
    subscriptionAmount: '0',
    adminEmail: payload.contact?.email ?? row?.email ?? '',
    adminFirstName: names.firstName,
    adminLastName: names.lastName,
    modules: modulesFromPayload(payload),
  };
}

async function fetchRegistrationRequest(
  requestId: string | undefined,
  accessToken: string,
): Promise<RegistrationRequestDetail | null> {
  if (!requestId) {
    return null;
  }
  const res = await fetch(
    `${apiBase}/super-admin/registration-requests/${encodeURIComponent(requestId)}`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: 'no-store',
    },
  );
  if (res.status === 404) {
    notFound();
  }
  if (res.status === 401) {
    redirect(
      `/login?callbackUrl=/dashboard/admin/institutions/new?requestId=${encodeURIComponent(requestId)}`,
    );
  }
  if (!res.ok) {
    throw new Error(`Failed to load registration request (HTTP ${res.status})`);
  }
  return (await res.json()) as RegistrationRequestDetail;
}

export default async function NewInstitutionPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const session = await auth();

  if (!session?.accessToken || !session.user) {
    redirect('/login?callbackUrl=/dashboard/admin/institutions/new');
  }
  if (!session.user.permissions?.includes('*')) {
    return (
      <main className={styles.page}>
        <Link href="/dashboard" className={styles.breadcrumb}>
          ← Dashboard
        </Link>
        <section className={styles.warningCard}>
          Platform super administrator access is required to provision institutions.
        </section>
      </main>
    );
  }

  const requestId = params.requestId?.trim();
  const row = await fetchRegistrationRequest(requestId, session.accessToken);
  const isJoinRequest = row?.kind === 'JOIN_INSTITUTION';
  const defaults = defaultsFromRequest(isJoinRequest ? null : row);
  const requestNotes = row ? notesFromPayload(row.payload ?? {}) : '';

  return (
    <main className={styles.page}>
      <Link
        href={requestId ? `/dashboard/admin/registration-requests/${requestId}` : '/dashboard'}
        className={styles.breadcrumb}
      >
        ← {requestId ? 'Registration request' : 'Dashboard'}
      </Link>

      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Tenant provisioning</p>
          <h1 className={styles.title}>Provision institution</h1>
          <p className={styles.subtitle}>
            Create the institution tenant, default MAIN campus, enabled modules, subscription, and
            first institution administrator.
          </p>
        </div>
        <Link href="/dashboard/admin/registration-requests" className={styles.secondaryLink}>
          Onboarding queue
        </Link>
      </header>

      {params.institutionId ? (
        <section className={styles.successCard}>
          <ProvisioningSuccessToast message="Institution tenant created. Temporary password email has been sent to the registrant/admin addresses." />
          <p className={styles.eyebrow}>Provisioned</p>
          <h2 className={styles.linkedTitle}>Institution tenant created</h2>
          <p className={styles.linkedText}>
            Institution ID <strong>{params.institutionId}</strong>
            {params.slug ? (
              <>
                {' '}
                with slug <strong>{params.slug}</strong>
              </>
            ) : null}
            . A temporary password has been generated and emailed to the registrant/admin addresses.
            The first administrator must change it at initial sign-in.
          </p>
          {params.requestId ? (
            <p className={styles.linkedText}>
              Linked request:{' '}
              <Link href={`/dashboard/admin/registration-requests/${params.requestId}`}>
                {params.requestId}
              </Link>
            </p>
          ) : null}
          <div className={styles.successActions}>
            <Link href="/dashboard/admin/registration-requests" className={styles.secondaryLink}>
              Return to onboarding queue
            </Link>
            <Link href="/dashboard" className={styles.secondaryLink}>
              Open dashboard
            </Link>
          </div>
        </section>
      ) : null}

      {row && !params.institutionId ? (
        <section className={styles.linkedCard}>
          <p className={styles.eyebrow}>Linked registration request</p>
          <h2 className={styles.linkedTitle}>{row.payload?.institutionName ?? row.email}</h2>
          <p className={styles.linkedText}>
            Reference <strong>{row.id}</strong> · Status <strong>{row.status}</strong> · Submitted{' '}
            {new Date(row.createdAt).toLocaleString()}
          </p>
          {requestNotes ? <pre className={styles.notes}>{requestNotes}</pre> : null}
        </section>
      ) : null}

      {params.institutionId ? null : isJoinRequest ? (
        <section className={styles.warningCard}>
          This is a join-institution request, not a new-tenant request. Provision the user inside
          the existing institution instead.
        </section>
      ) : (
        <div className={styles.grid}>
          <section className={styles.formCard}>
            <ProvisionInstitutionForm initialValues={defaults} />
          </section>
          <aside className={styles.formCard}>
            <h2 className={styles.sectionTitle}>Provisioning includes</h2>
            <dl className={styles.summaryList}>
              <SummaryRow label="Tenant" value="Institution record and active slug" />
              <SummaryRow label="Campus" value="Default MAIN campus provisioned" />
              <SummaryRow label="Modules" value="Selected module entitlements" />
              <SummaryRow label="Billing" value="Subscription and billing configuration" />
              <SummaryRow label="Admin" value="First administrator user and permissions" />
            </dl>
          </aside>
        </div>
      )}
    </main>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.summaryRow}>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
