import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { AlumniProfileForm } from '@/components/alumni-portal/alumni-profile-form';
import { fetchPortalJson } from '@/lib/portal-api';

type AlumniProfilePayload = {
  hasProfile: boolean;
  displayName: string;
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

export default async function AlumniProfilePage() {
  const session = await auth();
  if (!session?.accessToken || session.user.role !== 'ALUMNI') {
    redirect('/login');
  }

  const res = await fetchPortalJson<AlumniProfilePayload>('/portal/alumni/profile', session);

  return (
    <main style={{ maxWidth: 560 }}>
      <p style={{ margin: '0 0 0.5rem' }}>
        <Link href="/alumni/home" style={{ color: '#0d9488' }}>
          ← Home
        </Link>
      </p>
      <h1 style={{ margin: 0, fontSize: '1.5rem' }}>Your alumni profile</h1>
      <p style={{ color: '#64748b', marginTop: '0.35rem' }}>
        {res.ok ? res.data.displayName : session.user.email}
      </p>

      {!res.ok ? (
        <p style={{ color: '#b91c1c', marginTop: '1rem' }}>
          Could not load profile ({res.status}).
        </p>
      ) : (
        <section style={{ marginTop: '1.25rem' }}>
          <AlumniProfileForm
            canRegister={res.data.canRegister}
            initial={res.data.profile ?? undefined}
          />
        </section>
      )}
    </main>
  );
}
