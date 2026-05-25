import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { AlumniEventRegisterButton } from '@/components/alumni-portal/alumni-event-register-button';
import { fetchPortalJson } from '@/lib/portal-api';

type AlumniEvent = {
  id: string;
  title: string;
  description: string | null;
  startAt: string;
  endAt: string | null;
  location: string | null;
  isVirtual: boolean;
  fee: number;
  capacity: number | null;
  registrationCount: number;
  registrationDeadline: string | null;
  myRegistration: { paymentStatus: string; paymentUrl: string | null } | null;
};

export default async function AlumniEventsPage({
  searchParams,
}: {
  searchParams: Promise<{ registered?: string }>;
}) {
  const session = await auth();
  if (!session?.accessToken || session.user.role !== 'ALUMNI') {
    redirect('/login');
  }

  const sp = await searchParams;
  const res = await fetchPortalJson<AlumniEvent[]>('/portal/alumni/events', session);

  return (
    <main style={{ maxWidth: 900 }}>
      <p style={{ margin: '0 0 0.5rem' }}>
        <Link href="/dashboard/alumni/home" style={{ color: '#0d9488' }}>
          ← Home
        </Link>
      </p>
      <h1 style={{ margin: 0, fontSize: '1.5rem' }}>Alumni events</h1>
      {sp.registered === '1' ? (
        <p style={{ color: '#0d9488', marginTop: '0.5rem' }}>Registration recorded.</p>
      ) : null}

      {!res.ok ? (
        <p style={{ color: '#b91c1c', marginTop: '1rem' }}>Could not load events ({res.status}).</p>
      ) : res.data.length === 0 ? (
        <p style={{ color: '#64748b', marginTop: '1rem' }}>No events scheduled right now.</p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, marginTop: '1.25rem' }}>
          {res.data.map((e) => (
            <li
              key={e.id}
              style={{
                padding: '1rem',
                background: '#fff',
                border: '1px solid #e2e8f0',
                borderRadius: 10,
                marginBottom: 10,
              }}
            >
              <strong>{e.title}</strong>
              <p style={{ margin: '0.35rem 0', fontSize: '0.88rem', color: '#64748b' }}>
                {new Date(e.startAt).toLocaleString()}
                {e.isVirtual ? ' · Virtual' : e.location ? ` · ${e.location}` : ''}
                {e.fee > 0 ? ` · $${e.fee}` : ''}
              </p>
              {e.description ? (
                <p style={{ margin: '0.35rem 0', fontSize: '0.9rem' }}>{e.description}</p>
              ) : null}
              <p style={{ margin: '0.5rem 0 0', fontSize: '0.82rem', color: '#64748b' }}>
                {e.registrationCount} registered
                {e.capacity != null ? ` / ${e.capacity} capacity` : ''}
              </p>
              <AlumniEventRegisterButton
                eventId={e.id}
                fee={e.fee}
                paymentUrl={e.myRegistration?.paymentUrl}
                paymentStatus={e.myRegistration?.paymentStatus}
              />
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
