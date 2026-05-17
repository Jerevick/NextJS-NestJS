'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

type Question = {
  id: string;
  type: string;
  content: unknown;
  points: number;
  sortOrder: number;
};

function questionPrompt(content: unknown): string {
  if (content && typeof content === 'object' && 'prompt' in content) {
    const p = (content as { prompt: unknown }).prompt;
    if (typeof p === 'string') {
      return p;
    }
  }
  if (typeof content === 'string') {
    return content;
  }
  return 'Question';
}

export function AssessmentSubmissionForm({
  assessmentId,
  studentId,
  questions,
  apiBase,
  accessToken,
}: {
  assessmentId: string;
  studentId: string;
  questions: Question[];
  apiBase: string;
  accessToken: string;
}) {
  const router = useRouter();
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    setSuccess(null);

    const answerPayload: Record<string, unknown> = {};
    for (const q of questions) {
      answerPayload[q.id] = answers[q.id] ?? '';
    }

    try {
      const createRes = await fetch(
        `${apiBase}/lms/assessments/${encodeURIComponent(assessmentId)}/submissions`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ studentId, answers: answerPayload }),
        },
      );
      const createRaw = await createRes.text();
      if (!createRes.ok) {
        let message = `Could not start submission (${createRes.status})`;
        try {
          const j = JSON.parse(createRaw) as { message?: string };
          if (typeof j.message === 'string') {
            message = j.message;
          }
        } catch {
          if (createRaw) {
            message = createRaw.slice(0, 200);
          }
        }
        setError(message);
        return;
      }

      const submission = JSON.parse(createRaw) as { id: string };
      const submitRes = await fetch(
        `${apiBase}/lms/submissions/${encodeURIComponent(submission.id)}/submit`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ answers: answerPayload }),
        },
      );
      if (!submitRes.ok) {
        const submitRaw = await submitRes.text();
        setError(submitRaw.slice(0, 300) || `Submit failed (${submitRes.status})`);
        return;
      }

      setSuccess('Submission sent successfully.');
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <form
      onSubmit={(e) => void handleSubmit(e)}
      style={{ marginTop: '1.5rem', display: 'grid', gap: '1rem' }}
    >
      {questions.length === 0 ? (
        <label style={{ display: 'grid', gap: 6 }}>
          <span style={{ fontWeight: 600 }}>Response</span>
          <textarea
            rows={6}
            value={answers['__assignment'] ?? ''}
            onChange={(e) => setAnswers((a) => ({ ...a, __assignment: e.target.value }))}
            style={{ padding: '0.5rem', fontFamily: 'inherit' }}
          />
        </label>
      ) : (
        questions.map((q) => (
          <fieldset
            key={q.id}
            style={{
              border: '1px solid #e2e8f0',
              borderRadius: 8,
              padding: '0.75rem 1rem',
              margin: 0,
            }}
          >
            <legend style={{ fontWeight: 600, padding: '0 0.25rem' }}>
              {questionPrompt(q.content)}{' '}
              <span style={{ color: '#94a3b8', fontWeight: 400 }}>({q.points} pts)</span>
            </legend>
            {q.type === 'TRUE_FALSE' ? (
              <div style={{ display: 'flex', gap: 20, marginTop: 8 }}>
                {(['True', 'False'] as const).map((label) => (
                  <label key={label} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <input
                      type="radio"
                      name={q.id}
                      checked={answers[q.id] === label}
                      onChange={() => setAnswers((a) => ({ ...a, [q.id]: label }))}
                    />
                    {label}
                  </label>
                ))}
              </div>
            ) : q.type === 'MCQ' &&
              q.content &&
              typeof q.content === 'object' &&
              Array.isArray((q.content as { options?: unknown }).options) ? (
              <div style={{ display: 'grid', gap: 6, marginTop: 8 }}>
                {((q.content as { options: string[] }).options ?? []).map((opt) => (
                  <label key={opt} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <input
                      type="radio"
                      name={q.id}
                      value={opt}
                      checked={answers[q.id] === opt}
                      onChange={() => setAnswers((a) => ({ ...a, [q.id]: opt }))}
                    />
                    {opt}
                  </label>
                ))}
              </div>
            ) : (
              <textarea
                rows={3}
                value={answers[q.id] ?? ''}
                onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))}
                style={{ width: '100%', marginTop: 8, padding: '0.4rem' }}
              />
            )}
          </fieldset>
        ))
      )}
      <button
        type="submit"
        disabled={pending}
        style={{
          padding: '0.55rem 1rem',
          fontWeight: 600,
          background: '#2563eb',
          color: '#fff',
          border: 'none',
          borderRadius: 8,
          width: 'fit-content',
          cursor: pending ? 'wait' : 'pointer',
        }}
      >
        {pending ? 'Submitting…' : 'Submit assessment'}
      </button>
      {error ? (
        <p role="alert" style={{ color: '#b91c1c', margin: 0 }}>
          {error}
        </p>
      ) : null}
      {success ? <p style={{ color: '#166534', margin: 0 }}>{success}</p> : null}
    </form>
  );
}
