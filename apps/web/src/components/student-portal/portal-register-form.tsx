'use client';

import { useState } from 'react';
import { STUDENT_PORTAL } from '@/components/student-portal/student-portal-styles';

type Section = {
  id: string;
  maxEnrollment: number;
  enrolledCount: number;
  course: { code: string; title: string };
};

export function PortalRegisterForm({
  studentId,
  sections,
  readOnly,
}: {
  studentId: string;
  sections: Section[];
  readOnly: boolean;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function enroll(sectionId: string) {
    setPending(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch('/api/portal/enroll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId, sectionId }),
      });
      const body = (await res.json()) as { error?: string; ok?: boolean };
      if (!res.ok) {
        setError(body.error ?? `Enrollment failed (${res.status})`);
      } else {
        setMessage('Enrolled successfully.');
      }
    } catch {
      setError('Network error — try again.');
    } finally {
      setPending(false);
    }
  }

  if (readOnly) {
    return (
      <p style={{ color: STUDENT_PORTAL.muted }}>
        Course registration is unavailable while your enrollment status is not ACTIVE.
      </p>
    );
  }

  if (sections.length === 0) {
    return <p style={{ color: STUDENT_PORTAL.muted }}>No open sections for this semester.</p>;
  }

  return (
    <div style={{ display: 'grid', gap: '0.75rem', marginTop: '1rem' }}>
      {error ? (
        <p role="alert" style={{ color: '#b91c1c', margin: 0 }}>
          {error}
        </p>
      ) : null}
      {message ? <p style={{ color: '#166534', margin: 0 }}>{message}</p> : null}
      {sections.map((s) => {
        const full = s.enrolledCount >= s.maxEnrollment;
        const active = selected === s.id;
        return (
          <div
            key={s.id}
            style={{
              padding: '0.85rem 1rem',
              borderRadius: 10,
              border: `1px solid ${active ? STUDENT_PORTAL.teal : STUDENT_PORTAL.border}`,
              background: '#fff',
            }}
          >
            <div style={{ fontWeight: 600 }}>
              {s.course.code} — {s.course.title}
            </div>
            <div style={{ fontSize: '0.85rem', color: STUDENT_PORTAL.muted, marginTop: 4 }}>
              {s.enrolledCount}/{s.maxEnrollment} seats
              {full ? ' · Full' : ''}
            </div>
            <button
              type="button"
              disabled={pending || full}
              onClick={() => {
                setSelected(s.id);
                void enroll(s.id);
              }}
              style={{
                marginTop: 8,
                padding: '0.45rem 0.85rem',
                borderRadius: 8,
                border: 'none',
                background: STUDENT_PORTAL.teal,
                color: '#fff',
                fontWeight: 600,
                cursor: pending || full ? 'not-allowed' : 'pointer',
                opacity: pending || full ? 0.6 : 1,
              }}
            >
              {pending && active ? 'Enrolling…' : 'Enroll'}
            </button>
          </div>
        );
      })}
    </div>
  );
}
