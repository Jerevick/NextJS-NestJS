'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { upsertNotificationTemplate } from '@/app/settings/notifications/actions';

const DEFAULT_EVENTS = [
  'GRADE_RELEASED',
  'FEE_DUE',
  'STATUS_CHANGED',
  'WORKFLOW_ASSIGNED',
  'WORKFLOW_SLA_WARNING',
  'DOCUMENT_READY',
  'GENERIC',
] as const;

type TemplateRow = {
  event: string;
  subject?: string | null;
  textBody?: string | null;
  htmlBody?: string | null;
  entityId?: string | null;
};

export function NotificationTemplateEditor({
  templates,
  readOnly,
}: {
  templates: TemplateRow[];
  readOnly?: boolean;
}) {
  const router = useRouter();
  const events = [...new Set([...DEFAULT_EVENTS, ...templates.map((t) => t.event)])] as string[];
  const [event, setEvent] = useState<string>(events[0] ?? 'GENERIC');
  const existing = templates.find((t) => t.event === event && !t.entityId);
  const [subject, setSubject] = useState(existing?.subject ?? '');
  const [textBody, setTextBody] = useState(existing?.textBody ?? '');
  const [htmlBody, setHtmlBody] = useState(existing?.htmlBody ?? '');
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function onEventChange(next: string) {
    setEvent(next);
    const row = templates.find((t) => t.event === next && !t.entityId);
    setSubject(row?.subject ?? '');
    setTextBody(row?.textBody ?? '');
    setHtmlBody(row?.htmlBody ?? '');
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (readOnly) return;
    start(async () => {
      setMsg(null);
      const result = await upsertNotificationTemplate({
        event,
        subject: subject.trim() || undefined,
        textBody: textBody.trim() || undefined,
        htmlBody: htmlBody.trim() || undefined,
      });
      setMsg(result.error ?? 'Template saved');
      if (!result.error) router.refresh();
    });
  }

  const areaStyle = {
    width: '100%',
    minHeight: 80,
    padding: '0.5rem 0.65rem',
    borderRadius: 8,
    border: '1px solid #cbd5e1',
    fontFamily: 'inherit',
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: '1.5rem' }}>
      <aside>
        <h2 style={{ fontSize: '0.95rem', color: '#1e3a5f', marginTop: 0 }}>Events</h2>
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, fontSize: '0.85rem' }}>
          {events.map((ev) => {
            const customized = templates.some((t) => t.event === ev && !t.entityId);
            return (
              <li key={ev}>
                <button
                  type="button"
                  onClick={() => onEventChange(ev)}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    padding: '0.45rem 0.5rem',
                    marginBottom: 4,
                    borderRadius: 6,
                    border: event === ev ? '1px solid #1e3a5f' : '1px solid transparent',
                    background: event === ev ? '#eff6ff' : 'transparent',
                    cursor: 'pointer',
                    fontWeight: event === ev ? 600 : 400,
                  }}
                >
                  {ev}
                  {customized ? (
                    <span style={{ color: '#15803d', marginLeft: 6, fontSize: '0.75rem' }}>●</span>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
        <p style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '0.75rem' }}>
          ● = institution override saved
        </p>
      </aside>

      <form onSubmit={onSubmit} style={{ display: 'grid', gap: '1rem' }}>
        <h2 style={{ margin: 0, fontSize: '1rem', color: '#1e3a5f' }}>{event}</h2>
        <label style={{ display: 'grid', gap: '0.35rem' }}>
          <span style={{ fontSize: '0.85rem', color: '#64748b' }}>Subject</span>
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            disabled={readOnly || pending}
            style={{ padding: '0.5rem 0.65rem', borderRadius: 8, border: '1px solid #cbd5e1' }}
          />
        </label>
        <label style={{ display: 'grid', gap: '0.35rem' }}>
          <span style={{ fontSize: '0.85rem', color: '#64748b' }}>Plain text body</span>
          <textarea
            value={textBody}
            onChange={(e) => setTextBody(e.target.value)}
            disabled={readOnly || pending}
            style={areaStyle}
          />
        </label>
        <label style={{ display: 'grid', gap: '0.35rem' }}>
          <span style={{ fontSize: '0.85rem', color: '#64748b' }}>HTML body (Handlebars)</span>
          <textarea
            value={htmlBody}
            onChange={(e) => setHtmlBody(e.target.value)}
            disabled={readOnly || pending}
            style={{ ...areaStyle, minHeight: 120 }}
          />
        </label>
        {!readOnly && (
          <button
            type="submit"
            disabled={pending}
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
            {pending ? 'Saving…' : 'Save template'}
          </button>
        )}
        {msg && (
          <p style={{ fontSize: '0.88rem', color: msg.includes('failed') ? '#b91c1c' : '#15803d' }}>
            {msg}
          </p>
        )}
      </form>
    </div>
  );
}
