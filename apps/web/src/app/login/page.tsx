'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { Suspense, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { loginSchema, type LoginFormValues } from '@/lib/login-schema';

const apiBase = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

const googleOAuth =
  typeof process.env.NEXT_PUBLIC_GOOGLE_OAUTH === 'string' &&
  process.env.NEXT_PUBLIC_GOOGLE_OAUTH === '1';

const microsoftOAuth =
  typeof process.env.NEXT_PUBLIC_MICROSOFT_OAUTH === 'string' &&
  process.env.NEXT_PUBLIC_MICROSOFT_OAUTH === '1';

export default function LoginPage() {
  return (
    <Suspense fallback={<main style={{ padding: '4rem', fontFamily: 'system-ui' }}>Loading…</main>}>
      <LoginPageInner />
    </Suspense>
  );
}

function LoginPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [magicBusy, setMagicBusy] = useState(false);

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
      institutionSlug: 'demo-university',
      mfaToken: '',
      rememberMe: false,
    },
  });

  useEffect(() => {
    const token = searchParams.get('magicToken');
    if (!token?.trim()) {
      return;
    }
    let cancelled = false;
    (async () => {
      setMagicBusy(true);
      setError(null);
      try {
        const res = await fetch(`${apiBase}/auth/magic-link/consume`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: token.trim() }),
        });
        if (!res.ok) {
          if (!cancelled) {
            setError('Magic link is invalid or expired.');
          }
          return;
        }
        const data = (await res.json()) as { accessToken?: string };
        if (!data.accessToken) {
          if (!cancelled) {
            setError('Magic link response was incomplete.');
          }
          return;
        }
        const sign = await signIn('credentials', {
          redirect: false,
          email: 'magic',
          password: 'magic',
          magicAccessToken: data.accessToken,
        });
        if (sign?.error) {
          if (!cancelled) {
            setError('Could not start session from magic link.');
          }
          return;
        }
        router.replace('/dashboard');
        router.refresh();
      } finally {
        if (!cancelled) {
          setMagicBusy(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router, searchParams]);

  async function onSubmit(values: LoginFormValues) {
    setError(null);
    const slug = values.institutionSlug?.trim() || undefined;
    const res = await signIn('credentials', {
      redirect: false,
      email: values.email,
      password: values.password,
      institutionSlug: slug,
      mfaToken: values.mfaToken?.trim() || undefined,
      rememberMe: values.rememberMe ? '1' : '0',
    });
    if (res?.error) {
      setError('Invalid email or password.');
      return;
    }
    router.push('/dashboard');
    router.refresh();
  }

  return (
    <main style={{ maxWidth: 400, margin: '4rem auto', fontFamily: 'system-ui', padding: '0 1rem' }}>
      <h1 style={{ fontSize: '1.5rem' }}>Sign in</h1>
      <p style={{ color: '#64748b', fontSize: '0.9rem' }}>
        Institution slug is required on localhost (matches seed: demo-university). Form uses Zod + react-hook-form
        (shadcn/ui can replace primitives later).
      </p>
      {magicBusy ? <p style={{ color: '#64748b' }}>Completing magic link…</p> : null}
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        style={{ display: 'grid', gap: '0.75rem', marginTop: '1rem' }}
        noValidate
      >
        <label style={{ display: 'grid', gap: 4 }}>
          <span>Institution slug</span>
          <input
            {...form.register('institutionSlug')}
            autoComplete="organization"
            style={{ padding: '0.5rem' }}
          />
          {form.formState.errors.institutionSlug ? (
            <span style={{ color: '#b91c1c', fontSize: '0.8rem' }}>
              {form.formState.errors.institutionSlug.message}
            </span>
          ) : null}
        </label>
        <label style={{ display: 'grid', gap: 4 }}>
          <span>Email</span>
          <input
            type="email"
            {...form.register('email')}
            required
            autoComplete="email"
            style={{ padding: '0.5rem' }}
          />
          {form.formState.errors.email ? (
            <span style={{ color: '#b91c1c', fontSize: '0.8rem' }}>{form.formState.errors.email.message}</span>
          ) : null}
        </label>
        <label style={{ display: 'grid', gap: 4 }}>
          <span>Password</span>
          <input
            type="password"
            {...form.register('password')}
            required
            autoComplete="current-password"
            style={{ padding: '0.5rem' }}
          />
          {form.formState.errors.password ? (
            <span style={{ color: '#b91c1c', fontSize: '0.8rem' }}>{form.formState.errors.password.message}</span>
          ) : null}
        </label>
        <label style={{ display: 'grid', gap: 4 }}>
          <span>Authenticator code (if MFA is enabled)</span>
          <input {...form.register('mfaToken')} inputMode="numeric" autoComplete="one-time-code" style={{ padding: '0.5rem' }} />
        </label>
        <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: '0.9rem' }}>
          <input type="checkbox" {...form.register('rememberMe')} />
          Remember this device (longer refresh session on the API)
        </label>
        {error ? <p style={{ color: '#b91c1c', margin: 0 }}>{error}</p> : null}
        <button type="submit" disabled={form.formState.isSubmitting || magicBusy} style={{ padding: '0.6rem' }}>
          {form.formState.isSubmitting ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
      <p style={{ fontSize: '0.85rem', marginTop: '1rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
        <Link href="/register">Create account</Link>
        <span style={{ color: '#cbd5e1' }}>|</span>
        <Link href="/forgot-password">Forgot password</Link>
      </p>
      {googleOAuth || microsoftOAuth ? (
        <>
          <p style={{ textAlign: 'center', color: '#94a3b8', margin: '1.25rem 0 0.5rem' }}>or</p>
          <div style={{ display: 'grid', gap: '0.5rem' }}>
            {googleOAuth ? (
              <button
                type="button"
                onClick={() => void signIn('google', { callbackUrl: '/dashboard' })}
                style={{ width: '100%', padding: '0.6rem' }}
              >
                Continue with Google
              </button>
            ) : null}
            {microsoftOAuth ? (
              <button
                type="button"
                onClick={() => void signIn('microsoft-entra-id', { callbackUrl: '/dashboard' })}
                style={{ width: '100%', padding: '0.6rem' }}
              >
                Continue with Microsoft
              </button>
            ) : null}
          </div>
          <p style={{ color: '#94a3b8', fontSize: '0.75rem', marginTop: '0.5rem' }}>
            Social sign-in does not yet issue an API token for SIS pages such as Students.
          </p>
        </>
      ) : null}
    </main>
  );
}
