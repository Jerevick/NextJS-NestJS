'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { loginSchema, type LoginFormValues } from '@/lib/login-schema';
import { AuthShell } from './auth-shell';
import styles from './auth.module.css';

const apiBase = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

const googleOAuth =
  typeof process.env.NEXT_PUBLIC_GOOGLE_OAUTH === 'string' &&
  process.env.NEXT_PUBLIC_GOOGLE_OAUTH === '1';

const microsoftOAuth =
  typeof process.env.NEXT_PUBLIC_MICROSOFT_OAUTH === 'string' &&
  process.env.NEXT_PUBLIC_MICROSOFT_OAUTH === '1';

export function LoginPage() {
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
    <AuthShell
      headline="Welcome back"
      lead="Sign in to your institution workspace. Use your institution slug on localhost (e.g. demo-university from seed data)."
    >
      <header className={styles.mainHeader}>
        <Link href="/" className={styles.backLink}>
          ← Back to home
        </Link>
        <Link href="/register" className={styles.signInLink}>
          New here? <strong>Get started</strong>
        </Link>
      </header>

      <div className={styles.panel}>
        <h2 className={styles.title}>Sign in</h2>
        <p className={styles.subtitle}>
          Email and password for provisioned accounts. MFA code required when enabled on your user.
        </p>

        {magicBusy ? <p className={styles.hint}>Completing magic link…</p> : null}

        <form className={styles.form} onSubmit={form.handleSubmit(onSubmit)} noValidate>
          <div className={styles.field}>
            <span className={styles.label}>Institution slug</span>
            <input
              className={styles.input}
              autoComplete="organization"
              {...form.register('institutionSlug')}
            />
            {form.formState.errors.institutionSlug ? (
              <p className={styles.error}>{form.formState.errors.institutionSlug.message}</p>
            ) : null}
          </div>

          <motion.div className={styles.field}>
            <span className={styles.label}>Email</span>
            <input
              type="email"
              className={styles.input}
              autoComplete="email"
              {...form.register('email')}
            />
            {form.formState.errors.email ? (
              <p className={styles.error}>{form.formState.errors.email.message}</p>
            ) : null}
          </motion.div>

          <div className={styles.field}>
            <span className={styles.label}>Password</span>
            <input
              type="password"
              className={styles.input}
              autoComplete="current-password"
              {...form.register('password')}
            />
            {form.formState.errors.password ? (
              <p className={styles.error}>{form.formState.errors.password.message}</p>
            ) : null}
          </div>

          <div className={styles.field}>
            <span className={styles.label}>Authenticator code (if MFA is enabled)</span>
            <input
              className={styles.input}
              inputMode="numeric"
              autoComplete="one-time-code"
              {...form.register('mfaToken')}
            />
          </div>

          <label className={styles.checkboxRow}>
            <input type="checkbox" {...form.register('rememberMe')} />
            <span>Remember this device (longer refresh session)</span>
          </label>

          {error ? <p className={styles.error}>{error}</p> : null}

          <button
            type="submit"
            className={styles.submit}
            disabled={form.formState.isSubmitting || magicBusy}
          >
            {form.formState.isSubmitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p className={styles.inlineLinks}>
          <Link href="/forgot-password">Forgot password</Link>
          <span aria-hidden>·</span>
          <Link href="/register">Onboard your institution</Link>
        </p>

        {googleOAuth || microsoftOAuth ? (
          <>
            <div className={styles.divider} aria-hidden>
              or
            </div>
            <motion.div className={styles.altActions}>
              {googleOAuth ? (
                <button
                  type="button"
                  className={styles.altBtn}
                  onClick={() => void signIn('google', { callbackUrl: '/dashboard' })}
                >
                  Continue with Google
                </button>
              ) : null}
              {microsoftOAuth ? (
                <button
                  type="button"
                  className={styles.altBtn}
                  onClick={() => void signIn('microsoft-entra-id', { callbackUrl: '/dashboard' })}
                >
                  Continue with Microsoft
                </button>
              ) : null}
            </motion.div>
            <p className={styles.footnote}>
              Social sign-in may not issue an API token for all SIS pages until fully wired.
            </p>
          </>
        ) : null}
      </div>
    </AuthShell>
  );
}
