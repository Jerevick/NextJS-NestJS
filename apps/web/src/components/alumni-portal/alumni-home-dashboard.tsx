import Link from 'next/link';
import { fetchDashboardJson } from '@/lib/dashboard-api';
import { fetchPortalJson } from '@/lib/portal-api';
import type { Session } from 'next-auth';
import { AlumniProfileForm } from './alumni-profile-form';

const C = {
  text: '#0f172a',
  muted: '#64748b',
  border: '#e2e8f0',
  accent: '#0d9488',
};

type AlumniPayload = {
  hasProfile: boolean;
  displayName: string;
  profile: {
    id: string;
    graduationYear: number | null;
    currentEmployer: string | null;
    jobTitle: string | null;
    mentorshipAvailable: boolean;
    programme: { name: string } | null;
    entity: { code: string; name: string };
    isVerified: boolean;
  } | null;
  upcomingEvents: Array<{
    id: string;
    title: string;
    startAt: string;
    endAt: string | null;
    location: string | null;
    isVirtual: boolean;
  }>;
  openJobsCount: number;
};

type PortalProfile = {
  hasProfile: boolean;
  canRegister: boolean;
  profile: {
    graduationYear: number | null;
    currentEmployer: string | null;
    jobTitle: string | null;
    industry: string | null;
    bio: string | null;
    mentorshipAvailable: boolean;
  } | null;
};

export async function AlumniHomeDashboard({
  session,
}: {
  session: Session & { accessToken: string };
}) {
  const [dashRes, profileRes] = await Promise.all([
    fetchDashboardJson<AlumniPayload>('/dashboard/alumni', session),
    fetchPortalJson<PortalProfile>('/portal/alumni/profile', session),
  ]);

  if (!dashRes.ok) {
    return (
      <main style={{ padding: '2rem' }}>
        <h1>Alumni portal</h1>
        <p style={{ color: '#b91c1c' }}>Could not load dashboard ({dashRes.status}).</p>
      </main>
    );
  }

  const d = dashRes.data;
  const portalProfile = profileRes.ok ? profileRes.data : null;

  return (
    <main style={{ padding: '0 0 2rem', maxWidth: 900 }}>
      <h1 style={{ margin: 0, fontSize: '1.75rem', color: C.text }}>
        Welcome{d.displayName ? `, ${d.displayName}` : ''}
      </h1>
      <p style={{ color: C.muted, marginTop: '0.35rem' }}>
        Your alumni community hub — events, careers, and mentorship.
      </p>

      <nav style={{ marginTop: '1rem', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
        <Link href="/dashboard/alumni/events" style={{ color: C.accent, fontWeight: 600 }}>
          Browse events →
        </Link>
        <Link href="/dashboard/alumni/jobs" style={{ color: C.accent, fontWeight: 600 }}>
          Career board →
        </Link>
        <Link href="/dashboard/alumni/profile" style={{ color: C.accent }}>
          Edit profile
        </Link>
      </nav>

      {!d.hasProfile ? (
        <section
          style={{
            marginTop: '1.25rem',
            padding: '1.25rem',
            borderRadius: 12,
            border: '1px solid #fcd34d',
            background: '#fffbeb',
          }}
        >
          <h2 style={{ margin: 0, fontSize: '1.05rem' }}>Complete your alumni profile</h2>
          <p style={{ color: C.muted, marginTop: '0.5rem', fontSize: '0.92rem' }}>
            Link your graduate record to join the directory, register for events, and appear in
            mentorship matching.
          </p>
          <section style={{ marginTop: '1rem' }}>
            <AlumniProfileForm
              canRegister={portalProfile?.canRegister ?? false}
              initial={portalProfile?.profile ?? undefined}
            />
          </section>
        </section>
      ) : (
        <section
          style={{
            marginTop: '1.25rem',
            padding: '1.25rem',
            borderRadius: 12,
            border: `1px solid ${C.border}`,
            background: '#fff',
          }}
        >
          <h2 style={{ margin: 0, fontSize: '1.05rem' }}>Your profile</h2>
          <p style={{ margin: '0.5rem 0 0', color: C.muted, fontSize: '0.92rem' }}>
            {d.profile?.programme?.name ?? 'Alumni'}
            {d.profile?.graduationYear ? ` · Class of ${d.profile.graduationYear}` : ''}
            {d.profile?.entity ? ` · ${d.profile.entity.name}` : ''}
          </p>
          {d.profile?.currentEmployer ? (
            <p style={{ margin: '0.35rem 0 0', fontSize: '0.92rem' }}>
              {d.profile.jobTitle ? `${d.profile.jobTitle} at ` : ''}
              {d.profile.currentEmployer}
            </p>
          ) : null}
          {d.profile?.mentorshipAvailable ? (
            <p
              style={{
                margin: '0.5rem 0 0',
                fontSize: '0.85rem',
                color: C.accent,
                fontWeight: 600,
              }}
            >
              Open to mentorship
            </p>
          ) : null}
          {!d.profile?.isVerified ? (
            <p style={{ margin: '0.5rem 0 0', fontSize: '0.82rem', color: '#b45309' }}>
              Profile pending verification
            </p>
          ) : null}
        </section>
      )}

      <section style={{ marginTop: '1.5rem', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
        <Link href="/dashboard/alumni/jobs" style={{ textDecoration: 'none' }}>
          <KpiCard label="Open job postings" value={String(d.openJobsCount)} />
        </Link>
        <Link href="/dashboard/alumni/events" style={{ textDecoration: 'none' }}>
          <KpiCard label="Upcoming events" value={String(d.upcomingEvents.length)} />
        </Link>
      </section>

      {d.upcomingEvents.length > 0 ? (
        <section style={{ marginTop: '1.75rem' }}>
          <h2 style={{ fontSize: '1.05rem' }}>
            Upcoming events{' '}
            <Link href="/dashboard/alumni/events" style={{ fontSize: '0.85rem', color: C.accent }}>
              View all
            </Link>
          </h2>
          <ul style={{ listStyle: 'none', padding: 0, marginTop: '0.65rem' }}>
            {d.upcomingEvents.map((e) => (
              <li
                key={e.id}
                style={{
                  padding: '0.85rem 1rem',
                  background: '#fff',
                  border: `1px solid ${C.border}`,
                  borderRadius: 10,
                  marginBottom: 8,
                }}
              >
                <strong>{e.title}</strong>
                <p style={{ margin: '0.35rem 0 0', fontSize: '0.85rem', color: C.muted }}>
                  {new Date(e.startAt).toLocaleString()}
                  {e.isVirtual ? ' · Virtual' : e.location ? ` · ${e.location}` : ''}
                </p>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <p style={{ marginTop: '1.25rem', color: C.muted }}>
          No upcoming events —{' '}
          <Link href="/dashboard/alumni/events" style={{ color: C.accent }}>
            check the events calendar
          </Link>
          .
        </p>
      )}
    </main>
  );
}

function KpiCard({ label, value }: { label: string; value: string }) {
  return (
    <section
      style={{
        padding: '0.85rem 1.25rem',
        background: '#fff',
        border: '1px solid #e2e8f0',
        borderRadius: 10,
        minWidth: 140,
        color: '#0f172a',
      }}
    >
      <p style={{ margin: 0, fontSize: '0.72rem', color: '#64748b', textTransform: 'uppercase' }}>
        {label}
      </p>
      <p style={{ margin: '0.25rem 0 0', fontSize: '1.5rem', fontWeight: 700 }}>{value}</p>
    </section>
  );
}
