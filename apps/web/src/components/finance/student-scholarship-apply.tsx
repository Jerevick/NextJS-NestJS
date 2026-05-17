'use client';

import { useEffect, useState, useTransition } from 'react';
import { submitScholarshipApplicationAction } from '@/app/finance/actions';
import { DynamicForm, type DynamicFormSchema } from '@/components/forms/dynamic-form';

type ScholarshipRow = { id: string; name: string; type: string };

export function StudentScholarshipApply({
  scholarships,
  apiBase,
  accessToken,
  institutionId,
  entityId,
}: {
  scholarships: ScholarshipRow[];
  apiBase: string;
  accessToken: string;
  institutionId: string;
  entityId?: string | null;
}) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [scholarshipId, setScholarshipId] = useState(scholarships[0]?.id ?? '');
  const [schema, setSchema] = useState<DynamicFormSchema | null>(null);
  const [responses, setResponses] = useState<Record<string, unknown>>({});
  const [statement, setStatement] = useState('');
  const [loadingSchema, setLoadingSchema] = useState(false);

  useEffect(() => {
    if (!scholarshipId || !accessToken) {
      setSchema(null);
      return;
    }
    let cancelled = false;
    setLoadingSchema(true);
    const headers: Record<string, string> = {
      Authorization: `Bearer ${accessToken}`,
      'X-Institution-ID': institutionId,
    };
    if (entityId) {
      headers['X-Entity-ID'] = entityId;
    }
    fetch(`${apiBase}/finance/scholarships/${encodeURIComponent(scholarshipId)}/application-form`, {
      headers,
      cache: 'no-store',
    })
      .then(async (res) => {
        if (!res.ok) {
          return null;
        }
        return (await res.json()) as { schema?: DynamicFormSchema | null };
      })
      .then((data) => {
        if (cancelled) return;
        setSchema(data?.schema ?? null);
        setResponses({});
      })
      .finally(() => {
        if (!cancelled) setLoadingSchema(false);
      });
    return () => {
      cancelled = true;
    };
  }, [scholarshipId, accessToken, institutionId, entityId]);

  if (scholarships.length === 0) {
    return null;
  }

  return (
    <form
      style={{ marginTop: '1.25rem', display: 'grid', gap: 8 }}
      onSubmit={(e) => {
        e.preventDefault();
        if (!scholarshipId) return;
        setMessage(null);
        const payload = schema ? responses : { personalStatement: statement.trim() };
        startTransition(async () => {
          const r = await submitScholarshipApplicationAction(scholarshipId, payload);
          setMessage(r.error ?? 'Application submitted.');
          if (r.ok) {
            setStatement('');
            setResponses({});
          }
        });
      }}
    >
      <h3 style={{ margin: 0, fontSize: '0.95rem', color: '#334155' }}>Scholarship applications</h3>
      <select
        value={scholarshipId}
        onChange={(e) => setScholarshipId(e.target.value)}
        style={{ padding: '0.45rem 0.6rem', borderRadius: 8, border: '1px solid #e2e8f0' }}
      >
        {scholarships.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name} ({s.type})
          </option>
        ))}
      </select>
      {loadingSchema ? (
        <p style={{ margin: 0, fontSize: '0.85rem', color: '#94a3b8' }}>
          Loading application form…
        </p>
      ) : schema ? (
        <DynamicForm
          schema={schema}
          values={responses}
          onChange={setResponses}
          disabled={pending}
        />
      ) : (
        <textarea
          placeholder="Brief statement (optional)"
          value={statement}
          onChange={(e) => setStatement(e.target.value)}
          rows={3}
          style={{ padding: '0.45rem 0.6rem', borderRadius: 8, border: '1px solid #e2e8f0' }}
        />
      )}
      <button
        type="submit"
        disabled={pending || !scholarshipId || loadingSchema}
        style={{
          padding: '0.5rem 1rem',
          borderRadius: 8,
          border: 'none',
          background: '#0d9488',
          color: '#fff',
          cursor: pending ? 'wait' : 'pointer',
          width: 'fit-content',
        }}
      >
        {pending ? 'Submitting…' : 'Apply'}
      </button>
      {message ? (
        <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b' }}>{message}</p>
      ) : null}
    </form>
  );
}
