'use client';

import { useCallback, useId, useMemo, useState } from 'react';

type TutorRole = 'user' | 'assistant';

type TutorMsg = { id: string; role: TutorRole; text: string };

function replyForMessage(
  courseTitle: string,
  lessonTitle: string | undefined,
  userText: string,
): string {
  const m = userText.trim().toLowerCase();
  if (!m.length) {
    return 'Say something—I am a deterministic preview until Phase 13 streams tutoring.';
  }
  if (/^hello|^hi\b|^hey\b/.test(m)) {
    return lessonTitle
      ? `Hey! You are in **${courseTitle}**, lesson “${lessonTitle}”. Streaming RAG tutoring is slated for Phase 13; meanwhile I echo study tips from your question.`
      : `Hey! You are browsing **${courseTitle}**. Add a keyword or syllabus question—I will answer conversationally once the tutor backend lands.`;
  }
  if (/summary|summarize/.test(m)) {
    return 'I cannot see raw lesson text here yet — ask faculty for a synopsis or skim “Course home”. Phase 13 will hydrate me with chunked lesson embeddings.';
  }
  if (/exam|quiz|test/.test(m)) {
    return 'Check the Assessments strip on Course home — attempts are routed through LMS assessments. Quiz timing + autosave are already live in **quiz-engine**.';
  }
  if (/chapter|minute|seek/.test(m)) {
    return 'Video instructors can drop `chapters: [{ title, timeSeconds }]` on lesson JSON; chips appear above the player for learners.';
  }
  return `I'll route “${userText
    .trim()
    .slice(
      0,
      220,
    )}” once the SSE tutor endpoint lands. Tip: jot notes in VIDEO lessons—they persist locally via your browser storage.`;
}

/** Collapsible right-rail tutor chat UX (deterministic stub until Phase 13 SSE/RAG). */
export function LmsAiTutorDrawer({
  courseTitle,
  lessonTitle,
}: {
  courseTitle: string;
  lessonTitle?: string | undefined;
}) {
  const [open, setOpen] = useState(false);
  const formId = useId();
  const [messages, setMessages] = useState<TutorMsg[]>(() => [
    {
      id: 'seed',
      role: 'assistant',
      text:
        lessonTitle != null && lessonTitle.length > 0
          ? `How can I help with “${lessonTitle}” inside ${courseTitle}? (Preview mode — canned replies until Phase 13.)`
          : `Questions about ${courseTitle}? Preview mode spins simple answers while RAG tutors ship.`,
    },
  ]);
  const [draft, setDraft] = useState('');

  const heading = useMemo(
    () =>
      lessonTitle && lessonTitle.length > 0 ? `Tutor · ${lessonTitle}` : `Tutor · ${courseTitle}`,
    [courseTitle, lessonTitle],
  );

  const submit = useCallback(() => {
    const text = draft.trim();
    if (!text.length) {
      return;
    }
    setDraft('');
    setMessages((prev) => {
      const userMsg: TutorMsg = {
        id: `u:${Date.now()}`,
        role: 'user',
        text,
      };
      const bot: TutorMsg = {
        id: `a:${Date.now()}`,
        role: 'assistant',
        text: replyForMessage(courseTitle, lessonTitle, text),
      };
      return [...prev, userMsg, bot];
    });
  }, [draft, courseTitle, lessonTitle]);

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
              Phase 13 swaps these canned replies with pgvector+RAG SSE — layout stays intact.
            </p>
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
                  {msg.text}
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
          <form
            style={{ padding: '0.55rem', borderTop: '1px solid #e2e8f0', display: 'flex', gap: 6 }}
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
          >
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Ask a syllabus question..."
              aria-label="Message to tutor"
              autoComplete="off"
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
                cursor: draft.trim() ? 'pointer' : 'not-allowed',
                padding: '0 0.9rem',
                fontSize: '0.78rem',
                fontWeight: 700,
                background: draft.trim() ? '#2563eb' : '#94a3b8',
                color: '#fff',
              }}
              disabled={!draft.trim()}
            >
              Send
            </button>
          </form>
        </div>
      ) : null}
    </aside>
  );
}
