import Link from 'next/link';
import type { Metadata } from 'next';
import { auth } from '@/auth';
import { appendOptionalEntityHeader } from '@/lib/api-headers';
import {
  RegistrationAlertsBanner,
  isRegistrationNotificationEvent,
  type RegistrationAlertItem,
} from './registration-alerts-banner';
import styles from './registration-requests.module.css';
import type {
  RegistrationRequestKind,
  RegistrationRequestRow,
  RegistrationRequestStatus,
} from './types';

const apiBase =
  process.env.AUTH_API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export const metadata: Metadata = {
  title: 'Registration requests — UniCore',
  description: 'Review pending institution onboarding submissions.',
};

const STATUS_FILTERS: Array<{ value: '' | RegistrationRequestStatus; label: string }> = [
  { value: '', label: 'All' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'REVIEWED', label: 'Reviewed' },
  { value: 'DISMISSED', label: 'Dismissed' },
];

type SearchParams = {
  status?: string;
  kind?: string;
};

function statusBadgeClass(status: RegistrationRequestStatus): string {
  if (status === 'REVIEWED') return styles.statusReviewed;
  if (status === 'DISMISSED') return styles.statusDismissed;
  return styles.statusPending;
}

function formatKind(kind: RegistrationRequestKind): string {
  return kind === 'NEW_INSTITUTION' ? 'New institution' : 'Join institution';
}

function formatDate(value: string): string {
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

export default async function RegistrationRequestsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const session = await auth();

  if (!session?.accessToken || !session.user) {
    return (
      <main className={styles.page}>
        <Link href="/login" className={styles.breadcrumb}>
          Sign in to continue
        </Link>
      </main>
    );
  }

  if (!session.user.permissions?.includes('*')) {
    return (
      <main className={styles.page}>
        <Link href="/admin" className={styles.breadcrumb}>
          ← Admin
        </Link>
        <h1 className={styles.title}>Registration requests</h1>
        <p className={styles.subtitle} style={{ color: '#b91c1c' }}>
          Platform super administrator access required to view onboarding submissions.
        </p>
      </main>
    );
  }

  const status = STATUS_FILTERS.some((f) => f.value === params.status)
    ? (params.status as RegistrationRequestStatus | '')
    : '';

  const qs = new URLSearchParams();
  if (status) qs.set('status', status);
  if (params.kind) qs.set('kind', params.kind);
  qs.set('limit', '100');

  const res = await fetch(`${apiBase}/super-admin/registration-requests?${qs.toString()}`, {
    headers: {
      Authorization: `Bearer ${session.accessToken}`,
    },
    cache: 'no-store',
  });

  let rows: RegistrationRequestRow[] = [];
  let fetchError: string | null = null;
  if (res.ok) {
    const data = (await res.json()) as { data?: RegistrationRequestRow[] };
    rows = data.data ?? [];
  } else {
    fetchError = `Failed to load registration requests (HTTP ${res.status})`;
  }

  const pendingCount = rows.filter((r) => r.status === 'PENDING').length;
  const reviewedCount = rows.filter((r) => r.status === 'REVIEWED').length;
  const dismissedCount = rows.filter((r) => r.status === 'DISMISSED').length;

  const notifHeaders: Record<string, string> = {
    Authorization: `Bearer ${session.accessToken}`,
    'X-Institution-ID': session.user.institutionId,
  };
  appendOptionalEntityHeader(notifHeaders, session.user);

  const notifRes = await fetch(`${apiBase}/notifications?unreadOnly=true&limit=15`, {
    headers: notifHeaders,
    cache: 'no-store',
  });

  let registrationAlerts: RegistrationAlertItem[] = [];
  if (notifRes.ok) {
    const notifPayload = (await notifRes.json()) as {
      data?: Array<{
        id: string;
        event?: string | null;
        title: string;
        body: string;
        actionUrl: string | null;
        createdAt: string;
      }>;
    };
    registrationAlerts = (notifPayload.data ?? [])
      .filter((n) => isRegistrationNotificationEvent(n.event))
      .slice(0, 5)
      .map((n) => ({
        id: n.id,
        event: n.event ?? null,
        title: n.title,
        body: n.body,
        actionUrl: n.actionUrl,
        createdAt: n.createdAt,
      }));
  }

  return (
    <main className={styles.page}>
      <Link href="/admin" className={styles.breadcrumb}>
        ← Admin
      </Link>

      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Platform operations</p>
          <h1 className={styles.title}>Institution onboarding requests</h1>
          <p className={styles.subtitle}>
            Review submissions from the public registration form. Approve to mark a request as
            reviewed (provision the tenant separately), or dismiss requests that should not be
            processed.
          </p>
        </div>
      </header>

      <RegistrationAlertsBanner alerts={registrationAlerts} />

      <section className={styles.summaryStrip}>
        <div className={styles.summaryCard}>
          <span className={styles.summaryLabel}>Total loaded</span>
          <span className={styles.summaryValue}>{rows.length}</span>
        </div>
        <div className={styles.summaryCard}>
          <span className={styles.summaryLabel}>Pending</span>
          <span className={styles.summaryValue}>{pendingCount}</span>
        </div>
        <div className={styles.summaryCard}>
          <span className={styles.summaryLabel}>Reviewed</span>
          <span className={styles.summaryValue}>{reviewedCount}</span>
        </div>
        <div className={styles.summaryCard}>
          <span className={styles.summaryLabel}>Dismissed</span>
          <span className={styles.summaryValue}>{dismissedCount}</span>
        </div>
      </section>

      <nav className={styles.filters} aria-label="Status filter">
        {STATUS_FILTERS.map((filter) => {
          const href = filter.value
            ? `/admin/registration-requests?status=${filter.value}`
            : '/admin/registration-requests';
          const isActive = (status || '') === filter.value;
          return (
            <Link
              key={filter.value || 'all'}
              href={href}
              className={`${styles.filterLink} ${isActive ? styles.filterLinkActive : ''}`}
            >
              {filter.label}
            </Link>
          );
        })}
      </nav>

      {fetchError ? (
        <div className={styles.tableCard}>
          <p className={styles.empty} style={{ color: '#b91c1c' }}>
            {fetchError}
          </p>
        </div>
      ) : rows.length === 0 ? (
        <div className={styles.tableCard}>
          <p className={styles.empty}>No registration requests match this filter yet.</p>
        </div>
      ) : (
        <div className={styles.tableCard}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Institution / contact</th>
                <th>Kind</th>
                <th>Status</th>
                <th>Submitted</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>
                    <span className={styles.cellInstitution}>
                      {row.payload?.institutionName ?? row.institution?.name ?? '—'}
                    </span>
                    <span className={styles.cellEmail}>
                      {row.payload?.contact?.fullName ? `${row.payload.contact.fullName} · ` : ''}
                      {row.email}
                    </span>
                  </td>
                  <td>
                    <span className={styles.kindBadge}>{formatKind(row.kind)}</span>
                  </td>
                  <td>
                    <span className={`${styles.statusBadge} ${statusBadgeClass(row.status)}`}>
                      {row.status}
                    </span>
                  </td>
                  <td>{formatDate(row.createdAt)}</td>
                  <td>
                    <Link
                      className={styles.viewLink}
                      href={`/admin/registration-requests/${row.id}`}
                    >
                      Review →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
