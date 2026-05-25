'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import {
  INSTITUTION_ENTITY_TYPES,
  type InstitutionEntityTypeValue,
} from '@/lib/institution-entity-types';
import { EntityTypeBadge } from './entity-type-badge';

const schema = z.object({
  code: z.string().min(1).max(32),
  name: z.string().min(1).max(200),
  type: z.string().min(1),
});

type FormValues = z.infer<typeof schema>;

const apiBase = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export function CreateEntityWizard() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [selectedType, setSelectedType] = useState<InstitutionEntityTypeValue | null>(null);
  const [provisionMessage, setProvisionMessage] = useState<string | null>(null);
  const [coupling, setCoupling] = useState<string>('');
  const [billingClassification, setBillingClassification] = useState<string>('');

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { code: '', name: '', type: '' },
  });

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/login?callbackUrl=/dashboard/entities/new');
    }
  }, [router, status]);

  if (status !== 'authenticated' || !session?.accessToken) {
    return null;
  }

  const inst = session.user.institutionId;
  const token = session.accessToken;

  async function pollUntilActive(entityId: string): Promise<boolean> {
    for (let i = 0; i < 90; i += 1) {
      const r = await fetch(`${apiBase}/institutions/${inst}/entities/${entityId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'X-Institution-ID': inst,
        },
        cache: 'no-store',
      });
      if (!r.ok) {
        return false;
      }
      const body = (await r.json()) as { status?: string };
      if (body.status === 'ACTIVE') {
        return true;
      }
      if (body.status !== 'PROVISIONING') {
        return body.status === 'ACTIVE';
      }
      setProvisionMessage(`Provisioning… (${i + 1})`);
      await new Promise((res) => setTimeout(res, 2000));
    }
    return false;
  }

  async function onCreate(values: FormValues): Promise<void> {
    setProvisionMessage('Submitting…');
    const res = await fetch(`${apiBase}/institutions/${inst}/entities`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        'X-Institution-ID': inst,
      },
      body: JSON.stringify({
        code: values.code.trim(),
        name: values.name.trim(),
        type: values.type,
        ...(coupling ? { coupling } : {}),
        ...(billingClassification ? { billingClassification } : {}),
      }),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { message?: string | string[] } | null;
      const message = Array.isArray(body?.message) ? body.message.join(' ') : body?.message;
      setProvisionMessage(
        message ?? `Create failed (${res.status}). Check code uniqueness and MAIN campus rule.`,
      );
      return;
    }
    const created = (await res.json()) as { id?: string; status?: string };
    if (!created.id) {
      setProvisionMessage('Unexpected response from server.');
      return;
    }
    setProvisionMessage('Queued for provisioning. Waiting until ACTIVE…');
    const ok = await pollUntilActive(created.id);
    if (ok) {
      router.push(`/dashboard/entities/${created.id}`);
      router.refresh();
      return;
    }
    setProvisionMessage(
      'Provisioning is taking longer than expected. Open the entity from the list — it may still be PROVISIONING.',
    );
  }

  return (
    <div style={{ marginTop: '1.5rem' }}>
      <div
        style={{
          display: 'flex',
          gap: 8,
          marginBottom: '1rem',
          fontSize: '0.85rem',
          color: '#64748b',
        }}
      >
        <span style={{ fontWeight: step === 0 ? 700 : 400 }}>1. Type</span>
        <span>→</span>
        <span style={{ fontWeight: step === 1 ? 700 : 400 }}>2. Details</span>
        <span>→</span>
        <span style={{ fontWeight: step === 2 ? 700 : 400 }}>3. Review</span>
      </div>

      <AnimatePresence mode="wait">
        {step === 0 ? (
          <motion.div
            key="step0"
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 12 }}
            style={{ display: 'grid', gap: '0.75rem' }}
          >
            {INSTITUTION_ENTITY_TYPES.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => {
                  setSelectedType(t.value);
                  form.setValue('type', t.value);
                  setStep(1);
                }}
                style={{
                  textAlign: 'left',
                  padding: '0.85rem 1rem',
                  borderRadius: 10,
                  border: selectedType === t.value ? '2px solid #2563eb' : '1px solid #e2e8f0',
                  background: '#fff',
                  cursor: 'pointer',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <strong>{t.label}</strong>
                  <EntityTypeBadge type={t.value} />
                </div>
                <div style={{ fontSize: '0.85rem', color: '#64748b', marginTop: 6 }}>
                  {t.description}
                </div>
              </button>
            ))}
          </motion.div>
        ) : null}

        {step === 1 ? (
          <motion.form
            key="step1"
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 12 }}
            onSubmit={form.handleSubmit(() => setStep(2))}
            style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}
          >
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Code</span>
              <input
                {...form.register('code')}
                style={{ padding: '0.5rem 0.6rem', borderRadius: 8, border: '1px solid #cbd5e1' }}
              />
            </label>
            {form.formState.errors.code ? (
              <span style={{ color: '#b91c1c', fontSize: '0.85rem' }}>
                {form.formState.errors.code.message}
              </span>
            ) : null}
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Name</span>
              <input
                {...form.register('name')}
                style={{ padding: '0.5rem 0.6rem', borderRadius: 8, border: '1px solid #cbd5e1' }}
              />
            </label>
            {form.formState.errors.name ? (
              <span style={{ color: '#b91c1c', fontSize: '0.85rem' }}>
                {form.formState.errors.name.message}
              </span>
            ) : null}
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Coupling (optional)</span>
              <select
                value={coupling}
                onChange={(e) => setCoupling(e.target.value)}
                style={{ padding: '0.5rem 0.6rem', borderRadius: 8, border: '1px solid #cbd5e1' }}
              >
                <option value="">Default for type</option>
                <option value="INTERNAL">Internal</option>
                <option value="PARTIAL">Partial</option>
                <option value="EXTERNAL">External</option>
              </select>
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Billing (optional)</span>
              <select
                value={billingClassification}
                onChange={(e) => setBillingClassification(e.target.value)}
                style={{ padding: '0.5rem 0.6rem', borderRadius: 8, border: '1px solid #cbd5e1' }}
              >
                <option value="">Default for type</option>
                <option value="BILLED_TO_PARENT">Billed to parent</option>
                <option value="BILLED_INDEPENDENTLY">Billed independently</option>
                <option value="EXEMPT">Exempt</option>
              </select>
            </label>
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <button
                type="button"
                onClick={() => setStep(0)}
                style={{
                  padding: '0.5rem 1rem',
                  borderRadius: 8,
                  border: '1px solid #cbd5e1',
                  background: '#fff',
                }}
              >
                Back
              </button>
              <button
                type="submit"
                style={{
                  padding: '0.5rem 1rem',
                  borderRadius: 8,
                  border: 'none',
                  background: '#2563eb',
                  color: '#fff',
                }}
              >
                Continue
              </button>
            </div>
          </motion.form>
        ) : null}

        {step === 2 ? (
          <motion.div
            key="step2"
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 12 }}
            style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}
          >
            <p style={{ margin: 0 }}>
              <EntityTypeBadge type={form.getValues('type')} />{' '}
              <strong>{form.getValues('name')}</strong> ({form.getValues('code')})
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                onClick={() => setStep(1)}
                style={{
                  padding: '0.5rem 1rem',
                  borderRadius: 8,
                  border: '1px solid #cbd5e1',
                  background: '#fff',
                }}
              >
                Back
              </button>
              <button
                type="button"
                onClick={() => void form.handleSubmit(onCreate)()}
                style={{
                  padding: '0.5rem 1rem',
                  borderRadius: 8,
                  border: 'none',
                  background: '#16a34a',
                  color: '#fff',
                }}
              >
                Create &amp; wait for ACTIVE
              </button>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {provisionMessage ? (
        <p style={{ marginTop: '1rem', color: '#334155', fontSize: '0.9rem' }}>
          {provisionMessage}
        </p>
      ) : null}

      <p style={{ marginTop: '1.5rem' }}>
        <Link href="/dashboard/entities" style={{ color: '#2563eb' }}>
          Cancel
        </Link>
      </p>
    </div>
  );
}
