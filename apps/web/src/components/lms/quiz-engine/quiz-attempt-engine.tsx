'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Socket } from 'socket.io-client';

import { connectRealtimeSocket } from '@/lib/realtime-socket';

type Question = {
  id: string;
  type: string;
  content: unknown;
  points: number;
};

type AttemptPayload = {
  submissionId: string;
  expiresAt: string | null;
  /** Server clock anchor for syncing the countdown timer to API time (Prompt **8.2.3**). */
  serverNow?: string | null;
  timeLimitMinutes: number | null;
  questions: Question[];
  answers: Record<string, unknown>;
};

function questionPrompt(content: unknown): string {
  if (content && typeof content === 'object' && 'prompt' in content) {
    const p = (content as { prompt: unknown }).prompt;
    if (typeof p === 'string') {
      return p;
    }
  }
  return 'Question';
}

function draftKey(submissionId: string) {
  return `unicore:lms-quiz-draft:${submissionId}`;
}

function isQuestionAnswered(q: Question, value: string | undefined): boolean {
  return Boolean(value?.trim()?.length);
}

/**
 * Prompt **8.2 (3)** — quiz UX: fullscreen lock, navigator, flags,
 * countdown synced to server (`serverNow` + authoritative `expiresAt`),
 * autosave every **30s** via **`quiz.draft.save`** WebSocket (REST PATCH fallback),
 * submission receipt with server **`submittedAt`** when returned.
 */
export function QuizAttemptShell({
  assessmentId,
  studentId,
  apiBase,
  accessToken,
}: {
  assessmentId: string;
  studentId: string;
  apiBase: string;
  accessToken: string;
}) {
  const router = useRouter();
  const shellRef = useRef<HTMLDivElement>(null);
  const fieldRefs = useRef<Record<string, HTMLFieldSetElement | null>>({});
  /** `serverNow − clientNow` for deadline math aligned with Nest clock. */
  const clockSkewMs = useRef(0);

  const [attempt, setAttempt] = useState<AttemptPayload | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [flagged, setFlagged] = useState<Record<string, boolean>>({});
  const [remainingSec, setRemainingSec] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitted, setSubmitted] = useState(false);
  const [receiptAt, setReceiptAt] = useState<string | null>(null);
  const [autosaveNotice, setAutosaveNotice] = useState<{
    ok: boolean;
    at?: string;
    via?: 'ws' | 'rest';
  } | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [wsConnected, setWsConnected] = useState(false);

  const answersRef = useRef<Record<string, string>>({});
  const flaggedRef = useRef<Record<string, boolean>>({});
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);
  useEffect(() => {
    flaggedRef.current = flagged;
  }, [flagged]);

  const anchorClock = useCallback((serverNowIso?: string | null) => {
    if (!serverNowIso) return;
    const t = Date.parse(serverNowIso);
    if (!Number.isFinite(t)) return;
    clockSkewMs.current = t - Date.now();
  }, []);

  const startAttempt = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await fetch(
      `${apiBase}/lms/assessments/${encodeURIComponent(assessmentId)}/attempts`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ studentId }),
      },
    );
    const raw = await res.text();
    if (!res.ok) {
      setError(raw.slice(0, 300) || `Could not start attempt (${res.status})`);
      setLoading(false);
      return;
    }
    const payload = JSON.parse(raw) as AttemptPayload;
    anchorClock(payload.serverNow);
    setAttempt(payload);
    let ans: Record<string, string> = {};
    if (payload.answers && typeof payload.answers === 'object') {
      for (const [k, v] of Object.entries(payload.answers as Record<string, unknown>)) {
        if (typeof v === 'string') {
          ans[k] = v;
        }
      }
    }
    let nextFlagged: Record<string, boolean> = {};
    try {
      const cached =
        typeof window !== 'undefined' ? localStorage.getItem(draftKey(payload.submissionId)) : null;
      if (cached) {
        const parsed = JSON.parse(cached) as {
          answers?: Record<string, string>;
          flagged?: Record<string, boolean>;
        };
        if (parsed.answers && typeof parsed.answers === 'object') {
          ans = { ...ans, ...parsed.answers };
        }
        if (parsed.flagged && typeof parsed.flagged === 'object') {
          nextFlagged = parsed.flagged;
        }
      }
    } catch {
      /* ignore */
    }
    setAnswers(ans);
    setFlagged(nextFlagged);
    setLoading(false);
  }, [apiBase, assessmentId, accessToken, studentId, anchorClock]);

  useEffect(() => {
    void startAttempt();
  }, [startAttempt]);

  useEffect(() => {
    if (!attempt || submitted || typeof window === 'undefined') {
      return;
    }
    const socket = connectRealtimeSocket(apiBase, accessToken);
    socketRef.current = socket;
    const onConnect = () => setWsConnected(true);
    const onDisconnect = () => setWsConnected(false);
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    if (socket.connected) {
      onConnect();
    }
    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.disconnect();
      socketRef.current = null;
      setWsConnected(false);
    };
  }, [attempt?.submissionId, submitted, apiBase, accessToken]);

  const persistLocal = useCallback(() => {
    if (!attempt || typeof window === 'undefined') return;
    try {
      localStorage.setItem(
        draftKey(attempt.submissionId),
        JSON.stringify({
          answers: answersRef.current,
          flagged: flaggedRef.current,
          at: Date.now(),
        }),
      );
    } catch {
      /* quota */
    }
  }, [attempt]);

  const pushDraftViaWebSocket = useCallback((): Promise<boolean> => {
    const socket = socketRef.current;
    if (!attempt || !socket?.connected) {
      return Promise.resolve(false);
    }
    return new Promise((resolve) => {
      const timer = window.setTimeout(() => resolve(false), 12_000);
      socket.emit(
        'quiz.draft.save',
        { submissionId: attempt.submissionId, answers: answersRef.current },
        (ack: { ok?: boolean; serverNow?: string; error?: string } | undefined) => {
          window.clearTimeout(timer);
          if (ack?.ok) {
            anchorClock(ack.serverNow);
            setAutosaveNotice({ ok: true, at: new Date().toISOString(), via: 'ws' });
            resolve(true);
            return;
          }
          resolve(false);
        },
      );
    });
  }, [attempt, anchorClock]);

  const pushDraftToServer = useCallback(async () => {
    if (!attempt || submitted || typeof window === 'undefined') return;
    persistLocal();
    const wsOk = await pushDraftViaWebSocket();
    if (wsOk) {
      return;
    }
    const res = await fetch(
      `${apiBase}/lms/submissions/${encodeURIComponent(attempt.submissionId)}/quiz-draft`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ answers: answersRef.current }),
      },
    );
    const raw = await res.text();
    if (!res.ok) {
      setAutosaveNotice({ ok: false, at: new Date().toISOString(), via: 'rest' });
      return;
    }
    try {
      const body = JSON.parse(raw) as { serverNow?: string };
      anchorClock(body.serverNow);
    } catch {
      /* ignore body */
    }
    setAutosaveNotice({ ok: true, at: new Date().toISOString(), via: 'rest' });
  }, [attempt, submitted, persistLocal, apiBase, accessToken, anchorClock, pushDraftViaWebSocket]);

  /** Local merge cache on every edit; server PATCH on a fixed 30s cadence (refs keep the interval stable). */
  useEffect(() => {
    if (!attempt || submitted) return;
    persistLocal();
  }, [attempt, submitted, answers, flagged, persistLocal]);

  /** WebSocket autosave every ~30s (PATCH fallback when socket offline). */
  useEffect(() => {
    if (!attempt || submitted || typeof window === 'undefined') return;
    void pushDraftToServer();
    const id = window.setInterval(() => {
      void pushDraftToServer();
    }, 30_000);
    return () => window.clearInterval(id);
  }, [attempt?.submissionId, submitted, pushDraftToServer]);

  useEffect(() => {
    if (!attempt?.expiresAt) {
      setRemainingSec(null);
      return;
    }
    const tick = () => {
      const expireMs = new Date(attempt.expiresAt as string).getTime();
      const skewedNow = Date.now() + clockSkewMs.current;
      setRemainingSec(Math.max(0, Math.floor((expireMs - skewedNow) / 1000)));
    };
    tick();
    const vid = window.setInterval(tick, 1000);
    return () => window.clearInterval(vid);
  }, [attempt?.expiresAt]);

  const handleSubmit = useCallback(async () => {
    if (!attempt || pending || submitted) {
      return;
    }
    setPending(true);
    setError(null);
    await pushDraftToServer();
    const res = await fetch(
      `${apiBase}/lms/submissions/${encodeURIComponent(attempt.submissionId)}/submit`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ answers }),
      },
    );
    const rw = await res.text();
    if (!res.ok) {
      setError(rw.slice(0, 300) || `Submit failed (${res.status})`);
      setPending(false);
      return;
    }
    let confirmed = new Date().toISOString();
    try {
      const body = JSON.parse(rw) as { submittedAt?: string | null };
      if (body.submittedAt) {
        confirmed = body.submittedAt;
      }
    } catch {
      /* fallback */
    }
    setSubmitted(true);
    setReceiptAt(confirmed);
    try {
      localStorage.removeItem(draftKey(attempt.submissionId));
    } catch {
      /* ignore */
    }
    router.refresh();
    setPending(false);
  }, [attempt, pending, submitted, answers, apiBase, accessToken, router, pushDraftToServer]);

  useEffect(() => {
    if (attempt?.expiresAt && remainingSec === 0 && !submitted && !pending) {
      void handleSubmit();
    }
  }, [attempt?.expiresAt, remainingSec, submitted, pending, handleSubmit]);

  const enterFullscreen = useCallback(() => {
    const el = shellRef.current;
    if (!el) return;
    void el.requestFullscreen?.().catch(() => undefined);
  }, []);

  const exitFullscreen = useCallback(() => {
    if (typeof document !== 'undefined' && document.fullscreenElement) {
      void document.exitFullscreen?.().catch(() => undefined);
    }
  }, []);

  useEffect(() => {
    const onFs = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  }, []);

  const persistManual = () => {
    void pushDraftToServer();
  };

  if (loading) {
    return <p style={{ color: '#64748b' }}>Starting quiz attempt…</p>;
  }

  if (error && !attempt) {
    return (
      <p role="alert" style={{ color: '#b91c1c' }}>
        {error}
      </p>
    );
  }

  if (!attempt) {
    return null;
  }

  const expired = remainingSec !== null && remainingSec <= 0;

  return (
    <div
      ref={shellRef}
      style={{
        marginTop: '1.5rem',
        padding: '1rem',
        border: '1px solid #e2e8f0',
        borderRadius: 12,
        background: '#fafafa',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '0.5rem',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '1rem',
        }}
      >
        {remainingSec !== null ? (
          <p style={{ margin: 0, fontWeight: 600, color: expired ? '#b91c1c' : '#0f1729' }}>
            Time remaining · server-synced {Math.floor(remainingSec / 60)}:
            {String(remainingSec % 60).padStart(2, '0')}
          </p>
        ) : (
          <span style={{ fontSize: '0.85rem', color: '#64748b' }}>Untimed attempt</span>
        )}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
          <button
            type="button"
            onClick={persistManual}
            style={{
              padding: '0.35rem 0.65rem',
              fontSize: '0.78rem',
              borderRadius: 6,
              cursor: 'pointer',
            }}
          >
            Save draft
          </button>
          {attempt.expiresAt ? (
            <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
              Autosaves ±30s{wsConnected ? ' · live WebSocket' : ' · REST fallback'}
            </span>
          ) : null}
          {!isFullscreen ? (
            <button
              type="button"
              onClick={enterFullscreen}
              style={{
                padding: '0.35rem 0.65rem',
                fontSize: '0.78rem',
                borderRadius: 6,
                cursor: 'pointer',
              }}
            >
              Full screen · focus lock
            </button>
          ) : (
            <button
              type="button"
              onClick={exitFullscreen}
              style={{
                padding: '0.35rem 0.65rem',
                fontSize: '0.78rem',
                borderRadius: 6,
                cursor: 'pointer',
              }}
            >
              Exit fullscreen
            </button>
          )}
        </div>
      </div>
      {autosaveNotice ? (
        <p
          style={{
            margin: '0 0 0.75rem',
            fontSize: '0.72rem',
            color: autosaveNotice.ok ? '#15803d' : '#b45309',
          }}
        >
          {autosaveNotice.ok ? 'Autosave OK' : 'Autosave failed — answers kept locally'}
          {autosaveNotice.via
            ? ` (${autosaveNotice.via === 'ws' ? 'WebSocket' : 'REST'})`
            : ''}{' '}
          {autosaveNotice.at ? `· ${autosaveNotice.at}` : ''}
        </p>
      ) : null}

      {submitted ? (
        <div
          style={{
            padding: '0.85rem',
            background: '#ecfdf5',
            borderRadius: 8,
            border: '1px solid #bbf7d0',
          }}
        >
          <p style={{ margin: 0, color: '#166534', fontWeight: 700 }}>Submission receipt</p>
          <p style={{ margin: '0.35rem 0 0', fontSize: '0.88rem', color: '#14532d' }}>
            Submission <code style={{ fontSize: '0.78rem' }}>{attempt.submissionId}</code>
          </p>
          {receiptAt ? (
            <p style={{ margin: '0.25rem 0 0', fontSize: '0.8rem', color: '#166534' }}>
              Confirmed at · {receiptAt}
            </p>
          ) : null}
        </div>
      ) : (
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <nav
            aria-label="Question navigator"
            style={{
              width: 200,
              flexShrink: 0,
              position: 'sticky',
              top: 12,
              maxHeight: 'min(440px, 58vh)',
              overflowY: 'auto',
              padding: '0.5rem',
              background: '#fff',
              border: '1px solid #e2e8f0',
              borderRadius: 8,
              fontSize: '0.8rem',
            }}
          >
            <div style={{ fontWeight: 700, marginBottom: 6, color: '#0f1729' }}>Questions</div>
            {attempt.questions.map((q, i) => {
              const answered = isQuestionAnswered(q, answers[q.id]);
              return (
                <div
                  key={q.id}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}
                >
                  <button
                    type="button"
                    style={{
                      border: flagged[q.id] ? '1px solid #f59e0b' : '1px solid #e2e8f0',
                      background: flagged[q.id] ? '#fffbeb' : answered ? '#dbeafe' : '#f8fafc',
                      cursor: 'pointer',
                      flex: '1 1 auto',
                      textAlign: 'left',
                      padding: '0.2rem 0.35rem',
                      borderRadius: 4,
                      fontSize: '0.76rem',
                    }}
                    onClick={() =>
                      fieldRefs.current[q.id]?.scrollIntoView({
                        behavior: 'smooth',
                        block: 'start',
                      })
                    }
                  >
                    Q{i + 1}
                    {answered ? ' ●' : ' ○'}
                    {flagged[q.id] ? ' ⚑' : ''}
                  </button>
                </div>
              );
            })}
          </nav>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void handleSubmit();
            }}
            style={{ display: 'grid', gap: '1rem', flex: '1 1 280px', minWidth: 0 }}
          >
            {attempt.questions.map((q) => (
              <fieldset
                key={q.id}
                ref={(el) => {
                  fieldRefs.current[q.id] = el;
                }}
                style={{
                  border: '1px solid #e2e8f0',
                  borderRadius: 8,
                  padding: '0.75rem 1rem',
                  margin: 0,
                }}
              >
                <legend
                  style={{
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    flexWrap: 'wrap',
                  }}
                >
                  <span>
                    {questionPrompt(q.content)}{' '}
                    <span style={{ color: '#94a3b8' }}>
                      ({q.points} pts{isQuestionAnswered(q, answers[q.id]) ? ' · Answered' : ''})
                    </span>
                  </span>
                  <label
                    style={{
                      fontSize: '0.72rem',
                      fontWeight: 500,
                      cursor: 'pointer',
                      color: '#64748b',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={Boolean(flagged[q.id])}
                      onChange={(e) => setFlagged((f) => ({ ...f, [q.id]: e.target.checked }))}
                      style={{ marginRight: 4 }}
                    />
                    Flag for review
                  </label>
                </legend>
                {q.type === 'TRUE_FALSE' ? (
                  <div style={{ display: 'flex', gap: 20, marginTop: 8 }}>
                    {(['True', 'False'] as const).map((label) => (
                      <label key={label} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <input
                          type="radio"
                          name={q.id}
                          checked={answers[q.id] === label}
                          disabled={expired || pending}
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
                      <label key={opt} style={{ display: 'flex', gap: 8 }}>
                        <input
                          type="radio"
                          name={q.id}
                          checked={answers[q.id] === opt}
                          disabled={expired || pending}
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
                    disabled={expired || pending}
                    onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))}
                    style={{ width: '100%', marginTop: 8, padding: '0.4rem' }}
                  />
                )}
              </fieldset>
            ))}
            <button
              type="submit"
              disabled={expired || pending}
              style={{
                padding: '0.55rem 1rem',
                fontWeight: 600,
                background: '#2563eb',
                color: '#fff',
                border: 'none',
                borderRadius: 8,
                width: 'fit-content',
                cursor: expired || pending ? 'not-allowed' : 'pointer',
              }}
            >
              {pending ? 'Submitting…' : 'Submit quiz'}
            </button>
            {error ? (
              <p role="alert" style={{ color: '#b91c1c', margin: 0 }}>
                {error}
              </p>
            ) : null}
          </form>
        </div>
      )}
    </div>
  );
}
