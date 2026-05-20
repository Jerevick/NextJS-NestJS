'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { confirmPasswordReset, requestPasswordReset } from '@/app/forgot-password/actions';
import {
  passwordResetConfirmSchema,
  passwordResetRequestSchema,
  type PasswordResetConfirmValues,
  type PasswordResetRequestValues,
} from '@/lib/forgot-password-schema';
import { AuthShell } from './auth-shell';
import styles from './auth.module.css';

export function ForgotPasswordPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token')?.trim() ?? '';

  if (token) {
    return <ResetPasswordForm token={token} onDone={() => router.push('/login')} />;
  }

  return <RequestResetForm />;
}

function RequestResetForm() {
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const form = useForm<PasswordResetRequestValues>({
    resolver: zodResolver(passwordResetRequestSchema),
    defaultValues: { email: '', institutionSlug: 'demo-university' },
  });

  async function onSubmit(values: PasswordResetRequestValues) {
    setError(null);
    const result = await requestPasswordReset(values);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setSent(true);
  }

  return (
    <AuthShell
      headline="Recover your account"
      lead="If an account exists for this email and institution, we will send a password reset link valid for one hour."
    >
      <header className={styles.mainHeader}>
        <Link href="/login" className={styles.backLink}>
          ← Back to sign in
        </Link>
      </header>

      <div className={styles.panel}>
        {sent ? (
          <div className={styles.successCard}>
            <div className={styles.successIcon} aria-hidden>
              ✓
            </div>
            <h2 className={styles.successTitle}>Check your email</h2>
            <p className={styles.successText}>
              If a matching account exists, a reset link has been sent. The link expires in one
              hour. With Mailhog running locally, open{' '}
              <a href="http://localhost:8025" target="_blank" rel="noreferrer">
                localhost:8025
              </a>{' '}
              to view the message.
            </p>
            <Link href="/login" className={styles.altBtn}>
              Return to sign in
            </Link>
          </div>
        ) : (
          <>
            <h2 className={styles.title}>Forgot password</h2>
            <p className={styles.subtitle}>
              Enter your institution slug and email. We never reveal whether an account exists.
            </p>

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

              <div className={styles.field}>
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
              </div>

              {error ? <p className={styles.error}>{error}</p> : null}

              <button
                type="submit"
                className={styles.submit}
                disabled={form.formState.isSubmitting}
              >
                {form.formState.isSubmitting ? 'Sending…' : 'Send reset link'}
              </button>
            </form>

            <p className={styles.footnote}>
              No account yet? Ask your institution administrator to create one, or{' '}
              <Link href="/register">onboard a new institution</Link>.
            </p>
          </>
        )}
      </div>
    </AuthShell>
  );
}

function ResetPasswordForm({ token, onDone }: { token: string; onDone: () => void }) {
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const form = useForm<PasswordResetConfirmValues>({
    resolver: zodResolver(passwordResetConfirmSchema),
    defaultValues: { password: '', confirmPassword: '' },
  });

  async function onSubmit(values: PasswordResetConfirmValues) {
    setError(null);
    const result = await confirmPasswordReset(token, values);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setDone(true);
  }

  return (
    <AuthShell
      headline="Set a new password"
      lead="Choose a strong password with at least eight characters. You will need to sign in again on other devices."
    >
      <header className={styles.mainHeader}>
        <Link href="/login" className={styles.backLink}>
          ← Back to sign in
        </Link>
      </header>

      <div className={styles.panel}>
        {done ? (
          <div className={styles.successCard}>
            <div className={styles.successIcon} aria-hidden>
              ✓
            </div>
            <h2 className={styles.successTitle}>Password updated</h2>
            <p className={styles.successText}>
              Your password has been changed. Active sessions on other devices have been signed out.
            </p>
            <button type="button" className={styles.submit} onClick={onDone}>
              Continue to sign in
            </button>
          </div>
        ) : (
          <>
            <h2 className={styles.title}>New password</h2>
            <p className={styles.subtitle}>Enter and confirm your new password below.</p>

            <form className={styles.form} onSubmit={form.handleSubmit(onSubmit)} noValidate>
              <div className={styles.field}>
                <span className={styles.label}>New password</span>
                <input
                  type="password"
                  className={styles.input}
                  autoComplete="new-password"
                  {...form.register('password')}
                />
                {form.formState.errors.password ? (
                  <p className={styles.error}>{form.formState.errors.password.message}</p>
                ) : null}
              </div>

              <div className={styles.field}>
                <span className={styles.label}>Confirm password</span>
                <input
                  type="password"
                  className={styles.input}
                  autoComplete="new-password"
                  {...form.register('confirmPassword')}
                />
                {form.formState.errors.confirmPassword ? (
                  <p className={styles.error}>{form.formState.errors.confirmPassword.message}</p>
                ) : null}
              </div>

              {error ? <p className={styles.error}>{error}</p> : null}

              <button
                type="submit"
                className={styles.submit}
                disabled={form.formState.isSubmitting}
              >
                {form.formState.isSubmitting ? 'Saving…' : 'Update password'}
              </button>
            </form>
          </>
        )}
      </div>
    </AuthShell>
  );
}
