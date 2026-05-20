'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { STUDENT_PORTAL } from './student-portal-styles';

const DOCUMENT_TYPES = [
  { value: 'TRANSCRIPT', label: 'Official transcript' },
  { value: 'ID', label: 'Student ID card' },
  { value: 'CERTIFICATE', label: 'Certificate' },
  { value: 'ATTESTATION', label: 'Attestation letter' },
  { value: 'CLEARANCE', label: 'Clearance letter' },
] as const;

type DocType = (typeof DOCUMENT_TYPES)[number]['value'];

const btnPrimary: React.CSSProperties = {
  padding: '0.55rem 1rem',
  background: STUDENT_PORTAL.teal,
  color: '#fff',
  border: 'none',
  borderRadius: 8,
  fontWeight: 600,
  cursor: 'pointer',
};

const btnSecondary: React.CSSProperties = {
  padding: '0.55rem 1rem',
  background: '#fff',
  color: STUDENT_PORTAL.text,
  border: `1px solid ${STUDENT_PORTAL.border}`,
  borderRadius: 8,
  fontWeight: 600,
  cursor: 'pointer',
};

export function DocumentRequestWizard({ readOnly }: { readOnly?: boolean }) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [type, setType] = useState<DocType>('TRANSCRIPT');
  const [title, setTitle] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedLabel = DOCUMENT_TYPES.find((t) => t.value === type)?.label ?? type;

  async function submit() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/portal/documents/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          title: title.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const body = await res.text();
        setError(body || `Request failed (${res.status})`);
        return;
      }
      setStep(4);
      router.refresh();
    } catch {
      setError('Network error — try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (readOnly) {
    return (
      <p style={{ color: STUDENT_PORTAL.muted, fontSize: '0.9rem' }}>
        Document requests are unavailable while your enrollment is inactive.
      </p>
    );
  }

  return (
    <section
      style={{
        marginTop: '1.5rem',
        padding: '1.25rem',
        background: '#fff',
        borderRadius: 12,
        border: `1px solid ${STUDENT_PORTAL.border}`,
      }}
    >
      <h2 style={{ margin: '0 0 0.5rem', fontSize: '1.05rem', color: STUDENT_PORTAL.text }}>
        Request a document
      </h2>
      <p style={{ margin: '0 0 1rem', fontSize: '0.88rem', color: STUDENT_PORTAL.muted }}>
        Step {Math.min(step, 3)} of 3
      </p>

      {step === 1 ? (
        <div>
          <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>Document type</label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as DocType)}
            style={{
              display: 'block',
              width: '100%',
              marginTop: 4,
              padding: '0.55rem 0.65rem',
              borderRadius: 8,
              border: `1px solid ${STUDENT_PORTAL.border}`,
            }}
          >
            {DOCUMENT_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
          <button type="button" onClick={() => setStep(2)} style={{ ...btnPrimary, marginTop: 12 }}>
            Next →
          </button>
        </div>
      ) : null}

      {step === 2 ? (
        <div>
          <p style={{ fontSize: '0.9rem', color: STUDENT_PORTAL.muted }}>
            You are requesting: <strong>{selectedLabel}</strong>
          </p>
          <label style={{ display: 'block', marginTop: 12, fontSize: '0.85rem', fontWeight: 600 }}>
            Custom title (optional)
          </label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={`e.g. ${selectedLabel} — Spring 2026`}
            maxLength={500}
            style={{
              width: '100%',
              marginTop: 4,
              padding: '0.55rem 0.65rem',
              borderRadius: 8,
              border: `1px solid ${STUDENT_PORTAL.border}`,
            }}
          />
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button type="button" onClick={() => setStep(1)} style={btnSecondary}>
              Back
            </button>
            <button type="button" onClick={() => setStep(3)} style={btnPrimary}>
              Review →
            </button>
          </div>
        </div>
      ) : null}

      {step === 3 ? (
        <div>
          <ul style={{ margin: 0, paddingLeft: '1.1rem', fontSize: '0.9rem' }}>
            <li>Type: {selectedLabel}</li>
            <li>Title: {title.trim() || `${selectedLabel} request`}</li>
          </ul>
          {error ? <p style={{ color: '#b91c1c', marginTop: 8 }}>{error}</p> : null}
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button
              type="button"
              onClick={() => setStep(2)}
              style={btnSecondary}
              disabled={submitting}
            >
              Back
            </button>
            <button type="button" onClick={submit} style={btnPrimary} disabled={submitting}>
              {submitting ? 'Submitting…' : 'Submit request'}
            </button>
          </div>
        </div>
      ) : null}

      {step === 4 ? (
        <p style={{ color: STUDENT_PORTAL.teal, fontWeight: 600 }}>
          Request submitted. Track status below or in your workflow inbox.
        </p>
      ) : null}
    </section>
  );
}
