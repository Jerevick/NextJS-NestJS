'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useState, useTransition } from 'react';

import {
  createCustomForm,
  publishCustomForm,
  type FormFieldInput,
} from '@/app/settings/custom-forms/actions';

const FIELD_TYPES = [
  'text',
  'textarea',
  'number',
  'date',
  'select',
  'multiselect',
  'file',
  'checkbox',
  'radio',
  'section_header',
  'conditional_logic',
] as const;

type FormSummary = { id: string; title: string; formType: string; status: string };

const fieldStyle = {
  padding: '0.4rem 0.55rem',
  borderRadius: 6,
  border: '1px solid #cbd5e1',
  fontSize: '0.88rem',
};

export function CustomFormBuilder({
  initialForms,
  readOnly,
}: {
  initialForms: FormSummary[];
  readOnly?: boolean;
}) {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [formType, setFormType] = useState('SURVEY');
  const [fields, setFields] = useState<FormFieldInput[]>([
    { id: 'q1', type: 'text', label: 'Your answer', required: true },
  ]);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const reorder = useCallback((from: number, to: number) => {
    if (from === to) return;
    setFields((prev) => {
      const next = [...prev];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });
  }, []);

  function addField() {
    const n = fields.length + 1;
    setFields((prev) => [...prev, { id: `q${n}`, type: 'text', label: `Question ${n}` }]);
  }

  function updateField(idx: number, patch: Partial<FormFieldInput>) {
    setFields((prev) => prev.map((f, i) => (i === idx ? { ...f, ...patch } : f)));
  }

  function removeField(idx: number) {
    setFields((prev) => prev.filter((_, i) => i !== idx));
  }

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (readOnly) return;
    start(async () => {
      setMsg(null);
      const result = await createCustomForm({
        formType,
        title: title.trim(),
        fields: fields.filter((f) => f.id && f.label),
      });
      if ('error' in result && result.error) {
        setMsg(result.error);
        return;
      }
      setTitle('');
      router.refresh();
    });
  }

  function handlePublish(formId: string) {
    if (readOnly) return;
    start(async () => {
      const result = await publishCustomForm(formId);
      setMsg(result.error ?? 'Published');
      router.refresh();
    });
  }

  return (
    <div style={{ display: 'grid', gap: '2rem' }}>
      <section>
        <h2 style={{ fontSize: '1rem', color: '#1e3a5f' }}>Existing forms</h2>
        {initialForms.length === 0 ? (
          <p style={{ color: '#64748b', fontSize: '0.9rem' }}>No custom forms yet.</p>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {initialForms.map((f) => (
              <li
                key={f.id}
                style={{
                  padding: '0.75rem 0',
                  borderBottom: '1px solid #e2e8f0',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '1rem',
                  flexWrap: 'wrap',
                }}
              >
                <span>
                  <strong>{f.title}</strong>{' '}
                  <span style={{ color: '#64748b', fontSize: '0.85rem' }}>
                    {f.formType} · {f.status}
                  </span>
                </span>
                {f.status === 'DRAFT' && !readOnly && (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => handlePublish(f.id)}
                    style={{
                      padding: '0.35rem 0.75rem',
                      borderRadius: 6,
                      border: '1px solid #1e3a5f',
                      background: '#fff',
                      color: '#1e3a5f',
                      cursor: 'pointer',
                    }}
                  >
                    Publish
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {!readOnly && (
        <section>
          <h2 style={{ fontSize: '1rem', color: '#1e3a5f' }}>Form builder</h2>
          <p style={{ fontSize: '0.88rem', color: '#64748b', marginTop: 0 }}>
            Drag fields by the handle to reorder. Use conditional logic via &quot;Show when&quot;.
          </p>
          <form onSubmit={handleCreate} style={{ display: 'grid', gap: '1rem' }}>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Form title"
              required
              style={fieldStyle}
            />
            <select
              value={formType}
              onChange={(e) => setFormType(e.target.value)}
              style={fieldStyle}
            >
              <option value="SURVEY">Survey</option>
              <option value="APPLICATION">Application</option>
              <option value="SCHOLARSHIP">Scholarship</option>
              <option value="FEEDBACK">Feedback</option>
            </select>

            <div style={{ display: 'grid', gap: '0.75rem' }}>
              {fields.map((field, idx) => (
                <div
                  key={`${field.id}-${idx}`}
                  draggable
                  onDragStart={() => setDragIdx(idx)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => {
                    if (dragIdx !== null) reorder(dragIdx, idx);
                    setDragIdx(null);
                  }}
                  style={{
                    display: 'grid',
                    gap: '0.5rem',
                    padding: '0.75rem',
                    borderRadius: 8,
                    border: dragIdx === idx ? '2px dashed #1e3a5f' : '1px solid #e2e8f0',
                    background: '#fff',
                  }}
                >
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <span
                      title="Drag to reorder"
                      style={{
                        cursor: 'grab',
                        color: '#94a3b8',
                        userSelect: 'none',
                        fontSize: '1.1rem',
                      }}
                    >
                      ⠿
                    </span>
                    <strong style={{ fontSize: '0.85rem', color: '#64748b' }}>
                      Field {idx + 1}
                    </strong>
                    <label
                      style={{ marginLeft: 'auto', fontSize: '0.8rem', display: 'flex', gap: 4 }}
                    >
                      <input
                        type="checkbox"
                        checked={Boolean(field.required)}
                        onChange={(e) => updateField(idx, { required: e.target.checked })}
                      />
                      Required
                    </label>
                    <button
                      type="button"
                      onClick={() => removeField(idx)}
                      style={{ border: 'none', background: 'transparent', color: '#b91c1c' }}
                    >
                      ×
                    </button>
                  </div>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr 1fr',
                      gap: '0.5rem',
                    }}
                  >
                    <input
                      value={field.id}
                      onChange={(e) => updateField(idx, { id: e.target.value })}
                      placeholder="field id"
                      style={fieldStyle}
                    />
                    <input
                      value={field.label}
                      onChange={(e) => updateField(idx, { label: e.target.value })}
                      placeholder="Label"
                      style={fieldStyle}
                    />
                    <select
                      value={field.type}
                      onChange={(e) => updateField(idx, { type: e.target.value })}
                      style={fieldStyle}
                    >
                      {FIELD_TYPES.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </div>
                  {(field.type === 'select' ||
                    field.type === 'multiselect' ||
                    field.type === 'radio') && (
                    <input
                      value={(field.options ?? []).join(', ')}
                      onChange={(e) =>
                        updateField(idx, {
                          options: e.target.value
                            .split(',')
                            .map((s) => s.trim())
                            .filter(Boolean),
                        })
                      }
                      placeholder="Options (comma-separated)"
                      style={fieldStyle}
                    />
                  )}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                    <input
                      value={field.showWhen?.fieldId ?? ''}
                      onChange={(e) =>
                        updateField(idx, {
                          showWhen: e.target.value
                            ? { fieldId: e.target.value, equals: field.showWhen?.equals ?? '' }
                            : undefined,
                        })
                      }
                      placeholder="Show when field id"
                      style={fieldStyle}
                    />
                    <input
                      value={String(field.showWhen?.equals ?? '')}
                      onChange={(e) =>
                        updateField(idx, {
                          showWhen: field.showWhen?.fieldId
                            ? { fieldId: field.showWhen.fieldId, equals: e.target.value }
                            : undefined,
                        })
                      }
                      placeholder="equals value"
                      style={fieldStyle}
                    />
                  </div>
                </div>
              ))}
              <button
                type="button"
                onClick={addField}
                style={{ width: 'fit-content', fontSize: '0.88rem' }}
              >
                + Add field
              </button>
            </div>

            <button
              type="submit"
              disabled={pending || !title.trim()}
              style={{
                padding: '0.6rem 1rem',
                borderRadius: 8,
                border: 'none',
                background: '#1e3a5f',
                color: '#fff',
                fontWeight: 600,
                width: 'fit-content',
              }}
            >
              {pending ? 'Creating…' : 'Create draft form'}
            </button>
          </form>
          {msg && (
            <p
              style={{ fontSize: '0.88rem', color: msg.includes('failed') ? '#b91c1c' : '#15803d' }}
            >
              {msg}
            </p>
          )}
        </section>
      )}
    </div>
  );
}
