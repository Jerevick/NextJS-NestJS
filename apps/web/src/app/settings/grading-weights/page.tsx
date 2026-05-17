import Link from 'next/link';

import { auth } from '@/auth';
import { buildApiHeaders, apiBase } from '@/lib/server-api';
import { hasPermission } from '@/lib/permissions';

import { GradingWeightsEditor } from './grading-weights-editor';

const primary = '#1e3a5f';
const muted = '#64748b';

type GovEffective = {
  componentWeights?: { key: string; label?: string; weight: number }[];
};

export default async function GradingWeightsPage() {
  const session = await auth();

  if (!session?.accessToken || !session.user?.institutionId) {
    return (
      <main style={{ padding: '2rem' }}>
        <Link href="/login">Sign in</Link>
      </main>
    );
  }

  const canConfigure = hasPermission(session.user.permissions, 'grades.write');

  if (!canConfigure) {
    return (
      <main style={{ padding: '2rem 1.5rem', maxWidth: 720 }}>
        <h1 style={{ color: primary, fontFamily: '"Crimson Pro", Georgia, serif' }}>
          Grading weights
        </h1>
        <p>
          You need <strong>grades.write</strong> to edit component weights.
        </p>
        <Link href="/dashboard" style={{ color: primary }}>
          Dashboard
        </Link>
      </main>
    );
  }

  const govRes = await fetch(`${apiBase}/grades/governance/effective`, {
    headers: buildApiHeaders(session),
    cache: 'no-store',
  });

  const rawWeights = govRes.ok
    ? (((await govRes.json()) as GovEffective).componentWeights ?? []).filter(
        (w) =>
          typeof w?.key === 'string' &&
          w.key &&
          typeof w.weight === 'number' &&
          Number.isFinite(w.weight),
      )
    : [];

  const bands = rawWeights.map((w) => ({
    key: w.key,
    label: typeof w.label === 'string' && w.label.trim() ? w.label.trim() : w.key,
    weight: w.weight,
  }));

  const fingerprint = bands
    .map((b) => `${b.key}:${b.weight}`)
    .sort()
    .join('|');

  return (
    <main
      style={{
        padding: '2rem 1.5rem',
        maxWidth: 900,
        fontFamily: '"IBM Plex Sans", system-ui',
        margin: '0 auto',
      }}
    >
      <nav
        style={{
          display: 'flex',
          gap: '1rem',
          marginBottom: '1rem',
          flexWrap: 'wrap',
          fontSize: '0.9rem',
        }}
      >
        <Link href="/dashboard" style={{ color: muted }}>
          Dashboard
        </Link>
        <Link href="/grades/entry" style={{ color: primary }}>
          Grade entry
        </Link>
      </nav>
      <h1 style={{ marginTop: 0, color: primary, fontFamily: '"Crimson Pro", Georgia, serif' }}>
        Grading component weights
      </h1>
      <p style={{ color: muted, fontSize: '0.92rem', marginTop: '-0.25rem' }}>
        Configure how sectional grade entry combines component scores before letter mapping. Applies
        institution-wide for all courses when enabled.
      </p>

      <GradingWeightsEditor key={fingerprint || 'defaults'} initialBands={bands} />
    </main>
  );
}
