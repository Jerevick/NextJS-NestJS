'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';

const apiBase = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

type TermsAcceptance = {
  institutionName?: string;
  accepted: boolean;
  acceptedAt?: string | null;
  acceptedByEmail?: string | null;
  version: string;
  canAccept: boolean;
};

export default function TermsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session, status, update } = useSession();
  const [terms, setTerms] = useState<TermsAcceptance | null>(null);
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const rawCallbackUrl = searchParams.get('callbackUrl');
  const callbackUrl = rawCallbackUrl?.startsWith('/') ? rawCallbackUrl : '/dashboard';

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace(`/login?callbackUrl=${encodeURIComponent('/terms')}`);
    }
  }, [router, status]);

  useEffect(() => {
    if (status !== 'authenticated' || !session?.accessToken || !session.user?.institutionId) {
      return;
    }
    let cancelled = false;
    (async () => {
      setError(null);
      const res = await fetch(
        `${apiBase}/institutions/${encodeURIComponent(session.user.institutionId)}/terms/acceptance`,
        {
          headers: {
            Authorization: `Bearer ${session.accessToken}`,
            'X-Institution-ID': session.user.institutionId,
          },
          cache: 'no-store',
        },
      );
      if (!res.ok) {
        if (!cancelled) {
          setError('Could not load the institution terms status.');
        }
        return;
      }
      const body = (await res.json()) as TermsAcceptance;
      if (cancelled) {
        return;
      }
      setTerms(body);
      if (body.accepted) {
        await update({ institutionTermsAccepted: true });
        router.replace(callbackUrl);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [callbackUrl, router, session?.accessToken, session?.user?.institutionId, status, update]);

  async function acceptTerms() {
    if (!session?.accessToken || !session.user?.institutionId || !accepted) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        `${apiBase}/institutions/${encodeURIComponent(session.user.institutionId)}/terms/accept`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.accessToken}`,
            'X-Institution-ID': session.user.institutionId,
          },
        },
      );
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { message?: string } | null;
        throw new Error(body?.message ?? 'Could not accept terms.');
      }
      await update({ institutionTermsAccepted: true });
      router.replace(callbackUrl);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not accept terms.');
    } finally {
      setBusy(false);
    }
  }

  if (status !== 'authenticated') {
    return null;
  }

  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        padding: '2rem',
        fontFamily: 'system-ui',
        background: '#f8fafc',
      }}
    >
      <section
        style={{
          width: 'min(100%, 720px)',
          border: '1px solid #e2e8f0',
          borderRadius: 18,
          background: '#fff',
          padding: '2rem',
          boxShadow: '0 24px 60px rgba(15, 23, 42, 0.08)',
        }}
      >
        <p style={{ margin: 0, color: '#64748b', fontSize: '0.9rem', fontWeight: 700 }}>
          Institution access requirement
        </p>
        <h1 style={{ margin: '0.5rem 0 0', color: '#0f172a' }}>Terms and conditions</h1>
        <p style={{ color: '#475569', lineHeight: 1.7 }}>
          {terms?.institutionName ?? 'Your institution'} must accept UniCore&apos;s terms and
          conditions before users can access the system. This applies to trial and active
          institutions.
        </p>

        <div
          style={{
            border: '1px solid #e2e8f0',
            borderRadius: 14,
            padding: '1rem',
            color: '#334155',
            lineHeight: 1.65,
            background: '#f8fafc',
          }}
        >
          By accepting, the institution confirms that it is authorized to use UniCore, will provide
          accurate onboarding and billing information, will protect account access, and will use the
          platform in line with applicable laws, data protection obligations, and UniCore operating
          policies.
        </div>

        {terms && !terms.canAccept ? (
          <p style={{ color: '#92400e', lineHeight: 1.6 }}>
            An authorized institution administrator must accept these terms before access can
            continue.
          </p>
        ) : (
          <label
            style={{
              display: 'flex',
              gap: 10,
              alignItems: 'flex-start',
              marginTop: '1rem',
              color: '#334155',
            }}
          >
            <input
              type="checkbox"
              checked={accepted}
              onChange={(event) => setAccepted(event.target.checked)}
              style={{ marginTop: 4 }}
            />
            <span>I am authorized to accept these terms on behalf of the institution.</span>
          </label>
        )}

        {error ? <p style={{ color: '#b91c1c' }}>{error}</p> : null}

        {terms?.canAccept ? (
          <button
            type="button"
            onClick={() => void acceptTerms()}
            disabled={!accepted || busy}
            style={{
              marginTop: '1.25rem',
              border: 'none',
              borderRadius: 10,
              padding: '0.8rem 1rem',
              background: !accepted || busy ? '#94a3b8' : '#2563eb',
              color: '#fff',
              fontWeight: 700,
              cursor: !accepted || busy ? 'not-allowed' : 'pointer',
            }}
          >
            {busy ? 'Accepting...' : 'Accept and continue'}
          </button>
        ) : null}
      </section>
    </main>
  );
}
