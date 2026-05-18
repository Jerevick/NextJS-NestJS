'use client';

type MyProfile = {
  id: string;
  staffNumber: string;
  name: string;
  email: string;
  photoUrl?: string | null;
  position: { title: string };
  orgUnit: { name: string };
  salary?: { amount: number; currency: string } | null;
};

type EntityAccess = {
  homeEntityId: string;
  teachingEntities: Array<{ id: string; code: string; name: string }>;
};

export function StaffMyProfile({
  profile,
  entityAccess,
}: {
  profile: MyProfile | null;
  entityAccess: EntityAccess | null;
}) {
  if (!profile) {
    return (
      <section style={sectionStyle}>
        <h2 style={{ margin: '0 0 0.5rem', fontSize: '1.05rem', color: '#0f1729' }}>
          My HR profile
        </h2>
        <p style={{ margin: 0, color: '#64748b', fontSize: '0.9rem' }}>
          No staff profile is linked to your account.
        </p>
      </section>
    );
  }

  return (
    <section style={sectionStyle}>
      <h2 style={{ margin: '0 0 0.75rem', fontSize: '1.05rem', color: '#0f1729' }}>
        My HR profile
      </h2>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        {profile.photoUrl ? (
          <img
            src={profile.photoUrl}
            alt=""
            width={48}
            height={48}
            style={{ borderRadius: '50%', objectFit: 'cover' }}
          />
        ) : null}
        <div>
          <strong style={{ fontSize: '0.95rem', color: '#0f1729' }}>{profile.name}</strong>
          <div style={{ fontSize: '0.82rem', color: '#64748b' }}>
            {profile.staffNumber} · {profile.position.title} · {profile.orgUnit.name}
          </div>
          {profile.salary ? (
            <div style={{ fontSize: '0.82rem', color: '#334155', marginTop: 4 }}>
              Salary: {profile.salary.amount.toLocaleString()} {profile.salary.currency}
            </div>
          ) : null}
        </div>
      </div>
      {entityAccess && entityAccess.teachingEntities.length > 0 ? (
        <p style={{ margin: '0.75rem 0 0', fontSize: '0.82rem', color: '#64748b' }}>
          Cross-entity teaching access:{' '}
          {entityAccess.teachingEntities.map((e) => e.name).join(', ')}
        </p>
      ) : null}
    </section>
  );
}

const sectionStyle = {
  marginTop: '1.25rem',
  padding: '1.25rem 1.5rem',
  background: '#fff',
  border: '1px solid #e2e8f0',
  borderRadius: 12,
} as const;
