'use client';

import { useState, useTransition } from 'react';
import { fetchAiAdvisorAction } from '@/app/students/[id]/actions';

type AdvisorResult = {
  narrative: string;
  atRisk: boolean;
  gaps: Array<{ description: string; severity?: string }>;
  recommendations: Array<{ courseCode?: string; title?: string; rationale: string }>;
  riskFlags: Array<{ flag: string; detail: string }>;
};

export function StudentAiAdvisorPanel({
  studentId,
  primary,
  accent,
  muted,
}: {
  studentId: string;
  primary: string;
  accent: string;
  muted: string;
}) {
  const [result, setResult] = useState<AdvisorResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <section
      style={{
        marginBottom: '2rem',
        padding: '1rem 1.1rem',
        border: `1px solid ${accent}`,
        borderRadius: 10,
        background: '#f0f9ff',
      }}
    >
      <h2 style={{ margin: '0 0 0.5rem', fontSize: '1rem', color: primary, fontWeight: 700 }}>
        AI academic advisor
      </h2>
      <p style={{ margin: '0 0 0.75rem', fontSize: '0.82rem', color: muted }}>
        Graduation gap analysis, course recommendations, and at-risk flags from programme
        requirements, career goals, and enrolment history across all entities.
      </p>
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          startTransition(async () => {
            const r = await fetchAiAdvisorAction(studentId);
            if ('error' in r) {
              setError(r.error);
              setResult(null);
              return;
            }
            setError(null);
            setResult(r);
          });
        }}
        style={{
          padding: '0.4rem 0.85rem',
          borderRadius: 8,
          border: 'none',
          background: '#2563eb',
          color: '#fff',
          fontWeight: 600,
          cursor: pending ? 'wait' : 'pointer',
        }}
      >
        {pending ? 'Generating…' : 'Generate AI insights'}
      </button>
      {error ? <p style={{ color: '#b91c1c', marginTop: '0.75rem' }}>{error}</p> : null}
      {result ? (
        <div style={{ marginTop: '1rem' }}>
          <p
            style={{
              fontSize: '0.85rem',
              color: result.atRisk ? '#b45309' : '#15803d',
              fontWeight: 600,
            }}
          >
            {result.atRisk ? 'At-risk signals present' : 'No major at-risk flags in supplied data'}
          </p>
          {result.gaps.length > 0 ? (
            <div style={{ marginTop: '0.75rem' }}>
              <h3 style={{ margin: '0 0 0.35rem', fontSize: '0.88rem', color: primary }}>
                Graduation gaps
              </h3>
              <ul style={{ margin: 0, paddingLeft: '1.2rem', fontSize: '0.85rem' }}>
                {result.gaps.map((g, i) => (
                  <li key={i}>
                    {g.description}
                    {g.severity ? ` (${g.severity})` : ''}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {result.recommendations.length > 0 ? (
            <div style={{ marginTop: '0.75rem' }}>
              <h3 style={{ margin: '0 0 0.35rem', fontSize: '0.88rem', color: primary }}>
                Course recommendations
              </h3>
              <ul style={{ margin: 0, paddingLeft: '1.2rem', fontSize: '0.85rem' }}>
                {result.recommendations.map((rec, i) => (
                  <li key={i}>
                    <strong>{rec.courseCode ?? rec.title ?? 'Course'}</strong>
                    {rec.title && rec.courseCode ? ` — ${rec.title}` : ''}: {rec.rationale}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {result.riskFlags.length > 0 ? (
            <div style={{ marginTop: '0.75rem' }}>
              <h3 style={{ margin: '0 0 0.35rem', fontSize: '0.88rem', color: primary }}>
                Risk flags
              </h3>
              <ul style={{ margin: 0, paddingLeft: '1.2rem', fontSize: '0.85rem' }}>
                {result.riskFlags.map((rf, i) => (
                  <li key={i}>
                    <strong>{rf.flag}</strong>: {rf.detail}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {result.narrative ? (
            <div
              style={{
                marginTop: '0.85rem',
                whiteSpace: 'pre-wrap',
                fontSize: '0.9rem',
                lineHeight: 1.5,
                color: '#0f172a',
                padding: '0.65rem',
                background: '#fff',
                borderRadius: 8,
                border: '1px solid #e2e8f0',
              }}
            >
              {result.narrative}
            </div>
          ) : null}
          <p style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: muted }}>AI-generated</p>
        </div>
      ) : null}
    </section>
  );
}
