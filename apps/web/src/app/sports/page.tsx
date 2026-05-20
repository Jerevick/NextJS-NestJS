import Link from 'next/link';
import { auth } from '@/auth';
import { SportsHub } from '@/components/sports/sports-hub';
import { appendOptionalEntityHeader } from '@/lib/api-headers';
import { hasPermission } from '@/lib/permissions';

const apiBase =
  process.env.AUTH_API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export default async function SportsPage() {
  const session = await auth();
  const canRead = hasPermission(session?.user?.permissions, 'sports.read');
  const canWrite = hasPermission(session?.user?.permissions, 'sports.write');

  if (!session?.accessToken) {
    return (
      <main style={{ padding: '2rem' }}>
        <p style={{ color: '#64748b' }}>Sign in to access sports.</p>
      </main>
    );
  }

  if (!canRead) {
    return (
      <main style={{ padding: '2rem', maxWidth: 720 }}>
        <h1 style={{ color: '#0f1729' }}>Sports</h1>
        <p style={{ color: '#64748b' }}>You need sports.read permission.</p>
      </main>
    );
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${session.accessToken}`,
    'X-Institution-ID': session.user.institutionId,
  };
  appendOptionalEntityHeader(headers, session.user);

  const [teamsRes, fixturesRes, facilitiesRes, bookingsRes, awardsRes, typesRes] =
    await Promise.all([
      fetch(`${apiBase}/sports/teams`, { headers, cache: 'no-store' }),
      fetch(`${apiBase}/sports/fixtures`, { headers, cache: 'no-store' }),
      fetch(`${apiBase}/sports/facilities`, { headers, cache: 'no-store' }),
      fetch(`${apiBase}/sports/bookings`, { headers, cache: 'no-store' }),
      fetch(`${apiBase}/sports/awards`, { headers, cache: 'no-store' }),
      fetch(`${apiBase}/sports/sport-types`, { headers, cache: 'no-store' }),
    ]);

  const teams = teamsRes.ok ? await teamsRes.json() : [];
  const fixtures = fixturesRes.ok ? await fixturesRes.json() : [];
  const facilities = facilitiesRes.ok ? await facilitiesRes.json() : [];
  const rawBookings = bookingsRes.ok ? await bookingsRes.json() : [];
  const awards = awardsRes.ok ? await awardsRes.json() : [];
  const sportTypes = typesRes.ok ? await typesRes.json() : [];

  const bookings = (Array.isArray(rawBookings) ? rawBookings : []).map(
    (b: { id: string; purpose: string; startTime: string; endTime: string }) => ({
      id: b.id,
      title: b.purpose,
      start: b.startTime,
      end: b.endTime,
    }),
  );

  return (
    <main style={{ padding: '2rem', maxWidth: 960, margin: '0 auto' }}>
      <p style={{ margin: '0 0 0.5rem' }}>
        <Link href="/dashboard" style={{ color: '#2563eb' }}>
          Dashboard
        </Link>
      </p>
      <h1 style={{ margin: '0 0 1rem', color: '#0f1729' }}>Sports</h1>
      <SportsHub
        teams={Array.isArray(teams) ? teams : []}
        fixtures={Array.isArray(fixtures) ? fixtures : []}
        facilities={Array.isArray(facilities) ? facilities : []}
        bookings={bookings}
        awards={Array.isArray(awards) ? awards : []}
        sportTypes={Array.isArray(sportTypes) ? sportTypes : []}
        canWrite={canWrite}
      />
    </main>
  );
}
