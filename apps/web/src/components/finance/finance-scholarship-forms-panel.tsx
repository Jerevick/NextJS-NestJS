'use client';

import { useState, useTransition } from 'react';
import { createScholarshipFormAction } from '@/app/finance/actions';

const defaultSchema = `{
  "title": "Scholarship application",
  "fields": [
    { "id": "gpa", "type": "number", "label": "GPA", "required": true },
    { "id": "statement", "type": "textarea", "label": "Personal statement", "required": true }
  ]
}`;

export function FinanceScholarshipFormsPanel({
  forms,
  canWrite,
}: {
  forms: Array<{ id: string; updatedAt: string }>;
  canWrite: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [schemaJson, setSchemaJson] = useState(defaultSchema);

  if (!canWrite) {
    return forms.length > 0 ? (
      <ul style={{ margin: 0, paddingLeft: '1.1rem', fontSize: '0.88rem' }}>
        {forms.map((f) => (
          <li key={f.id}>
            Form {f.id.slice(0, 8)}… · updated {new Date(f.updatedAt).toLocaleDateString()}
          </li>
        ))}
      </ul>
    ) : null;
  }

  return (
    <div style={{ display: 'grid', gap: 10, marginTop: '1rem' }}>
      <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b' }}>
        Create reusable application forms, then attach a form ID when creating a scholarship fund.
      </p>
      {forms.length > 0 ? (
        <ul style={{ margin: 0, paddingLeft: '1.1rem', fontSize: '0.88rem' }}>
          {forms.map((f) => (
            <li key={f.id}>
              <code style={{ fontSize: '0.8rem' }}>{f.id}</code> ·{' '}
              {new Date(f.updatedAt).toLocaleDateString()}
            </li>
          ))}
        </ul>
      ) : null}
      <textarea
        value={schemaJson}
        onChange={(e) => setSchemaJson(e.target.value)}
        rows={10}
        style={{
          fontFamily: 'ui-monospace, monospace',
          fontSize: '0.8rem',
          padding: '0.5rem',
          borderRadius: 8,
          border: '1px solid #e2e8f0',
        }}
      />
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          setMessage(null);
          let schema: Record<string, unknown>;
          try {
            schema = JSON.parse(schemaJson) as Record<string, unknown>;
          } catch {
            setMessage('Invalid JSON');
            return;
          }
          startTransition(async () => {
            const r = await createScholarshipFormAction(schema);
            setMessage(r.error ?? `Form created: ${r.formId ?? 'ok'}`);
          });
        }}
        style={{
          padding: '0.45rem 0.9rem',
          borderRadius: 8,
          border: 'none',
          background: '#1e3a5f',
          color: '#fff',
          width: 'fit-content',
          cursor: 'pointer',
        }}
      >
        {pending ? 'Saving…' : 'Create application form'}
      </button>
      {message ? (
        <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b' }}>{message}</p>
      ) : null}
    </div>
  );
}
