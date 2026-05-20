import Link from 'next/link';
import { auth } from '@/auth';
import { MeetingsHub } from '@/components/meetings/meetings-hub';
import { appendOptionalEntityHeader } from '@/lib/api-headers';
import { hasPermission } from '@/lib/permissions';

const apiBase =
  process.env.AUTH_API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export default async function MeetingsPage() {
  const session = await auth();
  const canRead =
    hasPermission(session?.user?.permissions, 'meetings.read') ||
    hasPermission(session?.user?.permissions, 'meetings.convene') ||
    hasPermission(session?.user?.permissions, 'meetings.write');
  const canConvene =
    hasPermission(session?.user?.permissions, 'meetings.convene') ||
    hasPermission(session?.user?.permissions, 'meetings.write');

  if (!session?.accessToken) {
    return (
      <main style={{ padding: '2rem' }}>
        <p style={{ color: '#64748b' }}>Sign in to access meetings.</p>
      </main>
    );
  }

  if (!canRead) {
    return (
      <main style={{ padding: '2rem', maxWidth: 720 }}>
        <h1 style={{ color: '#0f1729' }}>Meetings</h1>
        <p style={{ color: '#64748b' }}>You need meetings.read or meetings.convene permission.</p>
      </main>
    );
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${session.accessToken}`,
    'X-Institution-ID': session.user.institutionId,
  };
  appendOptionalEntityHeader(headers, session.user);

  let meetings: Array<{
    id: string;
    title: string;
    type: string;
    status: string;
    scheduledAt: string;
    location?: string | null;
    meetingLink?: string | null;
    orgUnit?: { name: string };
  }> = [];
  const meetingsRes = await fetch(`${apiBase}/meetings`, { headers, cache: 'no-store' });

  if (meetingsRes.ok) {
    const body = (await meetingsRes.json()) as { data?: typeof meetings };
    meetings = body.data ?? [];
  }

  let positions: Array<{ id: string; title: string }> = [];
  let orgUnits: Array<{ id: string; name: string }> = [];
  const entityId = session.user.entityId;
  if (entityId) {
    const [posRes, orgRes] = await Promise.all([
      fetch(`${apiBase}/positions?entityId=${encodeURIComponent(entityId)}`, {
        headers,
        cache: 'no-store',
      }),
      fetch(`${apiBase}/org-units?entityId=${encodeURIComponent(entityId)}`, {
        headers,
        cache: 'no-store',
      }),
    ]);
    if (posRes.ok) {
      const body = (await posRes.json()) as { data?: Array<{ id: string; title: string }> };
      positions = body.data ?? [];
    }
    if (orgRes.ok) {
      const body = (await orgRes.json()) as { data?: Array<{ id: string; name: string }> };
      orgUnits = body.data ?? [];
    }
  }

  return (
    <main style={{ padding: '2rem', maxWidth: 960, margin: '0 auto' }}>
      <p style={{ margin: '0 0 0.5rem' }}>
        <Link href="/dashboard" style={{ color: '#2563eb', fontSize: '0.9rem' }}>
          ← Dashboard
        </Link>
      </p>
      <h1 style={{ color: '#0f1729', margin: '0 0 0.25rem' }}>Meetings & governance</h1>
      <p style={{ color: '#64748b', margin: '0 0 1.5rem' }}>
        Agendas, attendance, resolutions, and AI-generated minutes.
      </p>
      <MeetingsHub
        meetings={meetings}
        positions={positions}
        orgUnits={orgUnits}
        canConvene={canConvene}
        currentUserId={session.user.id}
      />
    </main>
  );
}
