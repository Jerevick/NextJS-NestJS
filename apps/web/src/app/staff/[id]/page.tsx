import Link from 'next/link';
import { notFound } from 'next/navigation';
import { auth } from '@/auth';
import { appendOptionalEntityHeader } from '@/lib/api-headers';
import { hasPermission } from '@/lib/permissions';

const apiBase =
  process.env.AUTH_API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

type StaffProfile = {
  id: string;
  staffNumber: string;
  name: string;
  email: string;
  photoUrl?: string | null;
  employmentType?: string;
  officeLocation?: string | null;
  entity?: { id: string; code: string; name: string };
  orgUnit: { name: string; code?: string };
  position: { title: string; code?: string };
  specializations?: string[];
  researchInterests?: string[];
  qualifications?: unknown;
  publications?: unknown;
  salary?: { amount: number; currency: string } | null;
};

export default async function StaffProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ scope?: string }>;
}) {
  const { id } = await params;
  const { scope } = await searchParams;
  const session = await auth();
  if (!session?.accessToken) {
    return (
      <main style={{ padding: '2rem' }}>
        <Link href="/login">Sign in</Link>
      </main>
    );
  }

  const canStaff =
    hasPermission(session.user?.permissions, 'staff.read') ||
    hasPermission(session.user?.permissions, 'staff.write');

  if (!canStaff) {
    return (
      <main style={{ padding: '2rem' }}>
        <p>You need staff.read to view staff profiles.</p>
      </main>
    );
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${session.accessToken}`,
    'X-Institution-ID': session.user.institutionId,
  };
  appendOptionalEntityHeader(headers, session.user);

  const profileQs = scope === 'institution' ? '?scope=institution' : '';
  const res = await fetch(`${apiBase}/staff/profiles/${encodeURIComponent(id)}${profileQs}`, {
    headers,
    cache: 'no-store',
  });

  if (res.status === 404) notFound();
  if (!res.ok) {
    return (
      <main style={{ padding: '2rem' }}>
        <p>Could not load staff profile ({res.status}).</p>
        <Link href="/staff">← Staff & HR</Link>
      </main>
    );
  }

  const profile = (await res.json()) as StaffProfile;

  const quals = Array.isArray(profile.qualifications) ? (profile.qualifications as string[]) : [];
  const pubs = Array.isArray(profile.publications) ? (profile.publications as string[]) : [];

  return (
    <main
      style={{ padding: '2rem 2.5rem', maxWidth: 720, minHeight: '100vh', background: '#f8fafc' }}
    >
      <Link href="/staff" style={{ color: '#2563eb', fontSize: '0.9rem', textDecoration: 'none' }}>
        ← Staff & HR
      </Link>

      <header style={{ display: 'flex', gap: '1rem', marginTop: '1rem', alignItems: 'flex-start' }}>
        {profile.photoUrl ? (
          <img
            src={profile.photoUrl}
            alt=""
            width={72}
            height={72}
            style={{ borderRadius: 12, objectFit: 'cover' }}
          />
        ) : (
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: 12,
              background: '#e2e8f0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.5rem',
              color: '#64748b',
            }}
          >
            {profile.name.charAt(0)}
          </div>
        )}
        <div>
          <h1 style={{ margin: 0, color: '#0f1729' }}>{profile.name}</h1>
          <p style={{ margin: '0.25rem 0 0', fontFamily: 'monospace', color: '#64748b' }}>
            {profile.staffNumber}
          </p>
          <p style={{ margin: '0.25rem 0 0', color: '#334155' }}>{profile.email}</p>
        </div>
      </header>

      <section
        style={{
          marginTop: '1.5rem',
          padding: '1.25rem',
          background: '#fff',
          border: '1px solid #e2e8f0',
          borderRadius: 12,
        }}
      >
        <h2 style={{ margin: '0 0 0.75rem', fontSize: '1rem', color: '#0f1729' }}>Assignment</h2>
        <dl style={{ margin: 0, display: 'grid', gap: 8, fontSize: '0.9rem' }}>
          <div>
            <dt style={{ color: '#64748b' }}>Campus entity</dt>
            <dd style={{ margin: 0 }}>{profile.entity?.name ?? '—'}</dd>
          </div>
          <div>
            <dt style={{ color: '#64748b' }}>Org unit</dt>
            <dd style={{ margin: 0 }}>{profile.orgUnit.name}</dd>
          </div>
          <div>
            <dt style={{ color: '#64748b' }}>Position</dt>
            <dd style={{ margin: 0 }}>{profile.position.title}</dd>
          </div>
          {profile.officeLocation ? (
            <div>
              <dt style={{ color: '#64748b' }}>Office</dt>
              <dd style={{ margin: 0 }}>{profile.officeLocation}</dd>
            </div>
          ) : null}
          {profile.employmentType ? (
            <div>
              <dt style={{ color: '#64748b' }}>Employment</dt>
              <dd style={{ margin: 0 }}>{profile.employmentType}</dd>
            </div>
          ) : null}
        </dl>
      </section>

      {quals.length > 0 || pubs.length > 0 || profile.specializations?.length ? (
        <section
          style={{
            marginTop: '1rem',
            padding: '1.25rem',
            background: '#fff',
            border: '1px solid #e2e8f0',
            borderRadius: 12,
          }}
        >
          <h2 style={{ margin: '0 0 0.75rem', fontSize: '1rem', color: '#0f1729' }}>Profile</h2>
          {quals.length > 0 ? (
            <p style={{ margin: '0 0 0.5rem', fontSize: '0.9rem' }}>
              <strong>Qualifications:</strong> {quals.join(', ')}
            </p>
          ) : null}
          {profile.specializations?.length ? (
            <p style={{ margin: '0 0 0.5rem', fontSize: '0.9rem' }}>
              <strong>Specializations:</strong> {profile.specializations.join(', ')}
            </p>
          ) : null}
          {pubs.length > 0 ? (
            <p style={{ margin: 0, fontSize: '0.9rem' }}>
              <strong>Publications:</strong> {pubs.join(', ')}
            </p>
          ) : null}
        </section>
      ) : null}

      {profile.salary ? (
        <section
          style={{
            marginTop: '1rem',
            padding: '1.25rem',
            background: '#fffbeb',
            border: '1px solid #fde68a',
            borderRadius: 12,
            fontSize: '0.9rem',
          }}
        >
          <strong>Salary (restricted):</strong> {profile.salary.amount} {profile.salary.currency}
        </section>
      ) : null}
    </main>
  );
}
