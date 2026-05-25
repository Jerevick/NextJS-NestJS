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

type SigninInstitution = {
  id: string;
  name: string;
  slug: string;
};

export function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [magicBusy, setMagicBusy] = useState(false);
  const [institutions, setInstitutions] = useState<SigninInstitution[]>([]);
  const [institutionsLoading, setInstitutionsLoading] = useState(true);
  const [institutionsError, setInstitutionsError] = useState<string | null>(null);
  const initialInstitutionSlug =
    searchParams.get('institutionSlug')?.trim() || searchParams.get('institution')?.trim() || '';

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
      institutionSlug: initialInstitutionSlug,
      mfaToken: '',
    },
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setInstitutionsLoading(true);
      setInstitutionsError(null);
      try {
        const res = await fetch(`${apiBase}/auth/institutions`, { cache: 'no-store' });
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        const payload = (await res.json()) as { data?: SigninInstitution[] };
        const rows = (payload.data ?? []).filter((row) => row.slug && row.name);
        if (cancelled) {
          return;
        }
        setInstitutions(rows);
        const current = form.getValues('institutionSlug')?.trim();
        if (!current && rows.length === 1) {
          form.setValue('institutionSlug', rows[0]!.slug, { shouldValidate: true });
        }
      } catch {
        if (!cancelled) {
          setInstitutionsError('Could not load institution list. Refresh and try again.');
        }
      } finally {
        if (!cancelled) {
          setInstitutionsLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [form]);

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
        const sign = await signIn('credentials', {
          redirect: false,
          email: 'magic',
          password: 'magic',
          magicToken: token.trim(),
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
      lead="Sign in to your institution workspace. Select your institution, then enter your account credentials."
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
            <select
              className={styles.select}
              autoComplete="organization"
              disabled={institutionsLoading || institutions.length === 0}
              {...form.register('institutionSlug')}
            >
              <option value="">
                {institutionsLoading
                  ? 'Loading institutions...'
                  : institutions.length === 0
                    ? 'No institutions available'
                    : 'Select institution'}
              </option>
              {institutions.map((institution) => (
                <option key={institution.id} value={institution.slug}>
                  {institution.name} ({institution.slug})
                </option>
              ))}
            </select>
            {institutionsError ? <p className={styles.error}>{institutionsError}</p> : null}
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
