'use client';

import { useState, type FormEvent } from 'react';

import { readQuizSettingsShape } from './quiz-settings-shape';

export type AssessmentSettingsRow = {
  id: string;
  title: string;
  type: string;
  settings?: Record<string, unknown>;
};

export function QuizAssessmentSettingsForms({
  assessments,
  apiBase,
  accessToken,
}: {
  assessments: AssessmentSettingsRow[];
  apiBase: string;
  accessToken: string;
}) {
  const quizLike = assessments.filter((a) => a.type === 'QUIZ' || a.type === 'EXAM');
  if (quizLike.length === 0) {
    return null;
  }

  return (
    <section
      style={{
        marginTop: '1.75rem',
        padding: '1rem 1.15rem',
        background: '#fff',
        borderRadius: 12,
        border: '1px solid #e2e8f0',
      }}
    >
      <h3 style={{ margin: '0 0 0.5rem', fontSize: '1rem', color: '#0f1729' }}>
        Quiz & exam settings
      </h3>
      <p style={{ margin: '0 0 1rem', fontSize: '0.85rem', color: '#64748b' }}>
        Max attempts, optional time limit, shuffle, and auto-scoring for MCQs on submit.
      </p>
      <div style={{ display: 'grid', gap: '1rem' }}>
        {quizLike.map((a) => (
          <QuizAssessmentRow
            key={a.id}
            assessment={a}
            apiBase={apiBase}
            accessToken={accessToken}
          />
        ))}
      </div>
    </section>
  );
}

function QuizAssessmentRow({
  assessment,
  apiBase,
  accessToken,
}: {
  assessment: AssessmentSettingsRow;
  apiBase: string;
  accessToken: string;
}) {
  const parsed = readQuizSettingsShape((assessment.settings ?? {}) as Record<string, unknown>);
  const [maxAttempts, setMaxAttempts] = useState(parsed.maxAttempts);
  const [timeLimit, setTimeLimit] = useState(parsed.timeLimitMinutes);
  const [shuffle, setShuffle] = useState(parsed.shuffleQuestions);
  const [autoGrade, setAutoGrade] = useState(parsed.autoGradeMcq);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    const prev = ((assessment.settings ?? {}) as Record<string, unknown>) ?? {};
    const settings = {
      ...prev,
      maxAttempts,
      timeLimitMinutes:
        timeLimit.trim() === '' || Number.isNaN(Number(timeLimit))
          ? null
          : Math.max(1, Math.floor(Number(timeLimit))),
      shuffleQuestions: shuffle,
      autoGradeMcq: autoGrade,
    };
    const res = await fetch(`${apiBase}/lms/assessments/${encodeURIComponent(assessment.id)}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ settings }),
    });
    setBusy(false);
    if (!res.ok) {
      const t = await res.text();
      setMessage(`Save failed: ${t.slice(0, 240)}`);
      return;
    }
    setMessage('Saved.');
  }

  const tlNum = Number(timeLimit);
  const tlInvalid =
    timeLimit.trim() !== '' && (Number.isNaN(tlNum) || tlNum < 1 || tlNum > 24 * 60);

  return (
    <form
      onSubmit={onSubmit}
      style={{
        border: '1px solid #f1f5f9',
        borderRadius: 8,
        padding: '0.85rem',
        background: '#f8fafc',
      }}
    >
      <div style={{ fontWeight: 600, color: '#0f1729', marginBottom: 8 }}>
        {assessment.title}{' '}
        <span style={{ fontWeight: 400, color: '#64748b', fontSize: '0.85rem' }}>
          ({assessment.type})
        </span>
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
          gap: 10,
        }}
      >
        <label style={{ display: 'grid', gap: 4, fontSize: '0.8rem', color: '#475569' }}>
          Max attempts
          <input
            type="number"
            min={1}
            max={20}
            value={maxAttempts}
            onChange={(e) => setMaxAttempts(Number(e.target.value))}
            style={{ padding: '0.35rem' }}
          />
        </label>
        <label style={{ display: 'grid', gap: 4, fontSize: '0.8rem', color: '#475569' }}>
          Time limit (min), empty = none
          <input
            type="number"
            min={1}
            max={1440}
            placeholder="—"
            value={timeLimit}
            onChange={(e) => setTimeLimit(e.target.value)}
            style={{ padding: '0.35rem' }}
          />
        </label>
      </div>
      <label
        style={{
          display: 'flex',
          gap: 8,
          marginTop: 10,
          alignItems: 'center',
          fontSize: '0.85rem',
          color: '#475569',
        }}
      >
        <input type="checkbox" checked={shuffle} onChange={(e) => setShuffle(e.target.checked)} />
        Shuffle questions when starting attempt
      </label>
      <label
        style={{
          display: 'flex',
          gap: 8,
          marginTop: 6,
          alignItems: 'center',
          fontSize: '0.85rem',
          color: '#475569',
        }}
      >
        <input
          type="checkbox"
          checked={autoGrade}
          onChange={(e) => setAutoGrade(e.target.checked)}
        />
        Auto-score MCQs on submit
      </label>
      <button
        type="submit"
        disabled={busy || Number.isNaN(maxAttempts) || maxAttempts < 1 || tlInvalid}
        style={{
          marginTop: 12,
          padding: '0.4rem 0.85rem',
          fontWeight: 600,
          background: '#2563eb',
          color: '#fff',
          border: 'none',
          borderRadius: 8,
        }}
      >
        {busy ? 'Saving…' : 'Save settings'}
      </button>
      {message ? (
        <p
          style={{
            margin: '8px 0 0',
            fontSize: '0.85rem',
            color: message.startsWith('Save failed') ? '#b91c1c' : '#166534',
          }}
        >
          {message}
        </p>
      ) : null}
    </form>
  );
}
