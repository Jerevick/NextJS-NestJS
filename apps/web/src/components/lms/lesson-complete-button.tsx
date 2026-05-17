'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function LessonCompleteButton({
  lessonId,
  studentId,
  apiBase,
  accessToken,
  alreadyCompleted,
}: {
  lessonId: string;
  studentId: string;
  apiBase: string;
  accessToken: string;
  alreadyCompleted: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(alreadyCompleted);
  const [error, setError] = useState<string | null>(null);

  async function markComplete() {
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`${apiBase}/lms/lessons/${encodeURIComponent(lessonId)}/complete`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ studentId, timeSpent: 0 }),
      });
      const raw = await res.text();
      if (!res.ok) {
        let message = `Could not mark complete (${res.status})`;
        try {
          const j = JSON.parse(raw) as { message?: string };
          if (typeof j.message === 'string') {
            message = j.message;
          }
        } catch {
          if (raw) {
            message = raw.slice(0, 200);
          }
        }
        setError(message);
        return;
      }
      setDone(true);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  if (done) {
    return (
      <p style={{ marginTop: '1.25rem', color: '#166534', fontWeight: 600, fontSize: '0.9rem' }}>
        Lesson marked complete
      </p>
    );
  }

  return (
    <div style={{ marginTop: '1.25rem' }}>
      <button
        type="button"
        onClick={() => void markComplete()}
        disabled={pending}
        style={{
          padding: '0.55rem 1.1rem',
          fontWeight: 600,
          background: '#2563eb',
          color: '#fff',
          border: 'none',
          borderRadius: 8,
          cursor: pending ? 'wait' : 'pointer',
        }}
      >
        {pending ? 'Saving…' : 'Mark lesson complete'}
      </button>
      {error ? (
        <p role="alert" style={{ color: '#b91c1c', fontSize: '0.85rem', marginTop: 8 }}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
