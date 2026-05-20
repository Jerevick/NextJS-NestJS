import Link from 'next/link';
import styles from './registration-requests.module.css';

export type RegistrationAlertItem = {
  id: string;
  event: string | null;
  title: string;
  body: string;
  actionUrl: string | null;
  createdAt: string;
};

const REGISTRATION_EVENTS = new Set([
  'REGISTRATION_SUBMITTED',
  'REGISTRATION_REVIEWED',
  'REGISTRATION_DISMISSED',
]);

export function isRegistrationNotificationEvent(event: string | null | undefined): boolean {
  return Boolean(event && REGISTRATION_EVENTS.has(event));
}

function eventLabel(event: string | null): string {
  if (event === 'REGISTRATION_SUBMITTED') return 'New submission';
  if (event === 'REGISTRATION_REVIEWED') return 'Reviewed';
  if (event === 'REGISTRATION_DISMISSED') return 'Dismissed';
  return 'Registration';
}

function formatWhen(value: string): string {
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

export function RegistrationAlertsBanner({ alerts }: { alerts: RegistrationAlertItem[] }) {
  if (alerts.length === 0) {
    return null;
  }

  return (
    <section className={styles.alertsBanner} aria-label="Unread registration notifications">
      <div className={styles.alertsHeader}>
        <p className={styles.alertsEyebrow}>Activity feed</p>
        <h2 className={styles.alertsTitle}>
          Unread registration update{alerts.length === 1 ? '' : 's'} ({alerts.length})
        </h2>
      </div>
      <ul className={styles.alertsList}>
        {alerts.map((alert) => (
          <li key={alert.id} className={styles.alertsItem}>
            <div className={styles.alertsRow}>
              <span className={styles.alertsEvent}>{eventLabel(alert.event)}</span>
              <div className={styles.alertsBody}>
                <p className={styles.alertsItemTitle}>{alert.title}</p>
                <p className={styles.alertsItemText}>{alert.body}</p>
                <time className={styles.alertsTime} dateTime={alert.createdAt}>
                  {formatWhen(alert.createdAt)}
                </time>
              </div>
              {alert.actionUrl ? (
                <Link href={alert.actionUrl} className={styles.alertsOpen}>
                  Open →
                </Link>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
      <p className={styles.alertsFooter}>
        <Link href="/notifications" className={styles.alertsViewAll}>
          View all notifications →
        </Link>
      </p>
    </section>
  );
}
