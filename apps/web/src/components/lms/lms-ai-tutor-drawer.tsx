'use client';

import { useCallback, useId, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import { appendOptionalEntityHeader } from '@/lib/api-headers';

const apiPublic = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

type TutorRole = 'user' | 'assistant';

type TutorMsg = { id: string; role: TutorRole; text: string };

/** Collapsible right-rail tutor chat with SSE streaming when courseInstanceId is set. */
export function LmsAiTutorDrawer({
  courseInstanceId,
  courseTitle,
  lessonTitle,
}: {
  courseInstanceId: string;
  courseTitle: string;
  lessonTitle?: string | undefined;
}) {
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);
  const formId = useId();
  const [messages, setMessages] = useState<TutorMsg[]>(() => [
    {
      id: 'seed',
      role: 'assistant',
      text:
        lessonTitle != null && lessonTitle.length > 0
          ? `How can I help with “${lessonTitle}” in ${courseTitle}? Ask anything from the syllabus.`
          : `Questions about ${courseTitle}? I use course materials (RAG) to guide you.`,
    },
  ]);
  const [draft, setDraft] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [citations, setCitations] = useState<
    Array<{ sourceType: string; sourceId: string; title?: string; lessonId?: string }>
  >([]);
  const [tokenHint, setTokenHint] = useState<string | null>(null);

  const heading = useMemo(
    () =>
      lessonTitle && lessonTitle.length > 0 ? `Tutor · ${lessonTitle}` : `Tutor · ${courseTitle}`,
    [courseTitle, lessonTitle],
  );

  const submit = useCallback(async () => {
    const text = draft.trim();
    if (!text.length || streaming) return;
    setDraft('');
    const userMsg: TutorMsg = { id: `u:${Date.now()}`, role: 'user', text };
    const botId = `a:${Date.now()}`;
    setMessages((prev) => [...prev, userMsg, { id: botId, role: 'assistant', text: '' }]);

    const token = session?.accessToken;
    const institutionId = session?.user?.institutionId;
    if (!token || !institutionId) {
      setMessages((prev) =>
        prev.map((m) => (m.id === botId ? { ...m, text: 'Sign in to use the AI tutor.' } : m)),
      );
      return;
    }

    setStreaming(true);
    try {
      const headers: Record<string, string> = {
        Authorization: `Bearer ${token}`,
        'X-Institution-ID': institutionId,
        'Content-Type': 'application/json',
      };
      appendOptionalEntityHeader(headers, session.user);
      const res = await fetch(
        `${apiPublic}/ai/tutor/${encodeURIComponent(courseInstanceId)}/message`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify({ message: text }),
        },
      );
      if (!res.ok || !res.body) {
        throw new Error(await res.text());
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split('\n\n');
        buffer = parts.pop() ?? '';
        for (const part of parts) {
          const line = part.split('\n').find((l) => l.startsWith('data: '));
          if (!line) continue;
          try {
            const payload = JSON.parse(line.slice(6)) as {
              chunk?: string;
              error?: string;
              done?: boolean;
              citations?: Array<{
                sourceType: string;
                sourceId: string;
                title?: string;
                lessonId?: string;
              }>;
              tokensRemaining?: number | null;
              dailyTokenLimit?: number | null;
            };
            if (payload.error) throw new Error(payload.error);
            if (payload.done) {
              if (payload.citations) setCitations(payload.citations);
              if (payload.dailyTokenLimit != null && payload.tokensRemaining != null) {
                setTokenHint(
                  `${payload.tokensRemaining.toLocaleString()} of ${payload.dailyTokenLimit.toLocaleString()} tutor tokens left today`,
                );
              }
            }
            if (payload.chunk) {
              setMessages((prev) =>
                prev.map((m) => (m.id === botId ? { ...m, text: m.text + payload.chunk } : m)),
              );
            }
          } catch {
            /* ignore partial JSON */
          }
        }
      }
    } catch (e) {
      setMessages((prev) =>
        prev.map((m) => (m.id === botId ? { ...m, text: `Tutor unavailable: ${String(e)}` } : m)),
      );
    } finally {
      setStreaming(false);
    }
  }, [draft, streaming, session, courseInstanceId]);

  return (
    <aside
      style={{
        width: open ? 320 : 44,
        flexShrink: 0,
        borderLeft: '1px solid #e2e8f0',
        background: '#fff',
        display: 'flex',
        flexDirection: 'column',
        transition: 'width 0.2s ease',
        minHeight: 200,
        maxHeight: '100vh',
        position: 'sticky',
        top: 0,
        alignSelf: 'stretch',
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{
          border: 'none',
          borderBottom: '1px solid #e2e8f0',
          background: '#f8fafc',
          cursor: 'pointer',
          padding: '0.5rem',
          fontSize: '0.75rem',
          fontWeight: 700,
          color: '#0f1729',
          textAlign: 'center',
          flexShrink: 0,
        }}
        aria-expanded={open}
        aria-controls={`${formId}-panel`}
      >
        {open ? '⟩ Collapse tutor' : '⟨'}
      </button>
      {open ? (
        <div
          id={`${formId}-panel`}
          style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}
        >
          <div style={{ padding: '0.75rem 0.85rem', borderBottom: '1px solid #e2e8f0' }}>
            <p style={{ margin: 0, fontWeight: 750, color: '#0f1729', fontSize: '0.88rem' }}>
              {heading}
            </p>
            <p
              style={{ margin: '4px 0 0', fontSize: '0.72rem', color: '#64748b', lineHeight: 1.4 }}
            >
              Socratic tutor — guides you using enrolled course materials only.
            </p>
            {tokenHint ? (
              <p style={{ margin: '4px 0 0', fontSize: '0.68rem', color: '#94a3b8' }}>
                {tokenHint}
              </p>
            ) : null}
          </div>
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '0.65rem',
              fontSize: '0.82rem',
              lineHeight: 1.45,
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              background: '#f8fafc',
            }}
          >
            {messages.map((msg) =>
              msg.role === 'assistant' ? (
                <div
                  key={msg.id}
                  style={{
                    alignSelf: 'flex-start',
                    maxWidth: '100%',
                    background: '#fff',
                    border: '1px solid #e2e8f0',
                    padding: '0.45rem 0.55rem',
                    borderRadius: 12,
                  }}
                >
                  {msg.text || (streaming ? '…' : '')}
                </div>
              ) : (
                <div
                  key={msg.id}
                  style={{
                    alignSelf: 'flex-end',
                    maxWidth: '100%',
                    background: '#dbeafe',
                    padding: '0.45rem 0.55rem',
                    borderRadius: 12,
                  }}
                >
                  {msg.text}
                </div>
              ),
            )}
          </div>
          {citations.length > 0 ? (
            <div
              style={{
                padding: '0.35rem 0.65rem',
                borderTop: '1px solid #e2e8f0',
                fontSize: '0.72rem',
                color: '#64748b',
              }}
            >
              Sources:{' '}
              {citations.map((c, i) => (
                <span key={`${c.sourceType}-${c.sourceId}`}>
                  {i > 0 ? ', ' : ''}
                  {c.title ?? `${c.sourceType}:${c.sourceId.slice(0, 6)}`}
                </span>
              ))}
            </div>
          ) : null}
          <form
            style={{ padding: '0.55rem', borderTop: '1px solid #e2e8f0', display: 'flex', gap: 6 }}
            onSubmit={(e) => {
              e.preventDefault();
              void submit();
            }}
          >
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Ask a syllabus question..."
              aria-label="Message to tutor"
              autoComplete="off"
              disabled={streaming}
              style={{
                flex: 1,
                minWidth: 0,
                padding: '0.45rem 0.55rem',
                borderRadius: 999,
                border: '1px solid #cbd5e1',
                fontSize: '0.82rem',
              }}
            />
            <button
              type="submit"
              style={{
                borderRadius: 999,
                border: 'none',
                cursor: draft.trim() && !streaming ? 'pointer' : 'not-allowed',
                padding: '0 0.9rem',
                fontSize: '0.78rem',
                fontWeight: 700,
                background: draft.trim() && !streaming ? '#2563eb' : '#94a3b8',
                color: '#fff',
              }}
              disabled={!draft.trim() || streaming}
            >
              {streaming ? '…' : 'Send'}
            </button>
          </form>
        </div>
      ) : null}
    </aside>
  );
}
