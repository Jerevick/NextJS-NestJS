'use client';

import { useState, useTransition } from 'react';
import {
  createAlumniEventAction,
  registerAlumniEventAction,
  sendNewsletterAction,
  suggestMentorshipAction,
} from '@/app/alumni/actions';

const panel: React.CSSProperties = {
  padding: '1.25rem',
  borderRadius: 12,
  border: '1px solid #e2e8f0',
  background: '#fff',
};

const inputStyle: React.CSSProperties = {
  padding: '0.5rem 0.75rem',
  borderRadius: 8,
  border: '1px solid #cbd5e1',
  width: '100%',
};

const btn: React.CSSProperties = {
  padding: '0.5rem 1rem',
  borderRadius: 8,
  border: 'none',
  background: '#2563eb',
  color: '#fff',
  cursor: 'pointer',
  fontWeight: 600,
};

type DirectoryRow = {
  id: string;
  name: string;
  graduationYear?: number | null;
  industry?: string | null;
  jobTitle?: string | null;
  mentorshipAvailable?: boolean;
};

type EventRow = {
  id: string;
  title: string;
  startDate: string;
  fee?: number | string;
};

export function AlumniHub({
  directory,
  events,
  jobs,
  campaigns,
  canWrite,
}: {
  directory: DirectoryRow[];
  events: EventRow[];
  jobs: Array<{ id: string; title: string; company: string }>;
  campaigns: Array<{ id: string; title: string; status: string; raisedAmount: number | string }>;
  canWrite: boolean;
}) {
  const [q, setQ] = useState('');
  const [studentId, setStudentId] = useState('');
  const [matches, setMatches] = useState<unknown>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const filtered = directory.filter((d) => {
    if (!q.trim()) return true;
    const hay = [d.name, d.industry, d.jobTitle].filter(Boolean).join(' ').toLowerCase();
    return hay.includes(q.trim().toLowerCase());
  });

  return (
    <div style={{ display: 'grid', gap: '1.25rem' }}>
      <section style={panel}>
        <h2 style={{ margin: '0 0 0.75rem', fontSize: '1.1rem' }}>Alumni directory</h2>
        <input
          style={inputStyle}
          placeholder="Search name, industry, role…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <ul style={{ margin: '0.75rem 0 0', paddingLeft: '1.1rem' }}>
          {filtered.slice(0, 20).map((d) => (
            <li key={d.id} style={{ marginBottom: 6 }}>
              <strong>{d.name}</strong>
              {d.graduationYear ? ` · Class of ${d.graduationYear}` : ''}
              {d.industry ? ` · ${d.industry}` : ''}
              {d.mentorshipAvailable ? ' · Mentorship available' : ''}
            </li>
          ))}
        </ul>
      </section>

      <section style={panel}>
        <h2 style={{ margin: '0 0 0.75rem', fontSize: '1.1rem' }}>Events</h2>
        <ul style={{ margin: 0, paddingLeft: '1.1rem' }}>
          {events.map((e) => (
            <li key={e.id} style={{ marginBottom: 8 }}>
              {e.title} — {new Date(e.startDate).toLocaleString()}
              {Number(e.fee) > 0 ? ` · Fee: ${e.fee}` : ''}
              <button
                type="button"
                style={{ ...btn, marginLeft: 8, fontSize: '0.8rem' }}
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    const r = await registerAlumniEventAction(e.id);
                    setMessage(r.error ?? 'Registration submitted');
                  })
                }
              >
                Register
              </button>
            </li>
          ))}
        </ul>
        {canWrite ? (
          <form
            style={{ marginTop: 12, display: 'grid', gap: 8 }}
            onSubmit={(ev) => {
              ev.preventDefault();
              const fd = new FormData(ev.currentTarget);
              start(async () => {
                const r = await createAlumniEventAction({
                  title: String(fd.get('title')),
                  startDate: String(fd.get('startDate')),
                  description: String(fd.get('description') || ''),
                  fee: Number(fd.get('fee') || 0),
                });
                setMessage(r.error ?? 'Event created');
              });
            }}
          >
            <input name="title" placeholder="Event title" style={inputStyle} required />
            <input name="startDate" type="datetime-local" style={inputStyle} required />
            <input
              name="fee"
              type="number"
              min={0}
              step="0.01"
              placeholder="Fee"
              style={inputStyle}
            />
            <textarea name="description" placeholder="Description" style={inputStyle} rows={2} />
            <button type="submit" style={btn} disabled={pending}>
              Create event
            </button>
          </form>
        ) : null}
      </section>

      <section style={panel}>
        <h2 style={{ margin: '0 0 0.75rem', fontSize: '1.1rem' }}>Job board</h2>
        <ul style={{ margin: 0, paddingLeft: '1.1rem' }}>
          {jobs.map((j) => (
            <li key={j.id}>
              {j.title} @ {j.company}
            </li>
          ))}
        </ul>
      </section>

      <section style={panel}>
        <h2 style={{ margin: '0 0 0.75rem', fontSize: '1.1rem' }}>Fundraising</h2>
        <ul style={{ margin: 0, paddingLeft: '1.1rem' }}>
          {campaigns.map((c) => (
            <li key={c.id}>
              {c.title} · {c.status} · raised {String(c.raisedAmount)}
            </li>
          ))}
        </ul>
      </section>

      {canWrite ? (
        <section style={panel}>
          <h2 style={{ margin: '0 0 0.75rem', fontSize: '1.1rem' }}>Mentorship matching</h2>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              style={inputStyle}
              placeholder="Student ID"
              value={studentId}
              onChange={(e) => setStudentId(e.target.value)}
            />
            <button
              type="button"
              style={btn}
              disabled={pending || !studentId}
              onClick={() =>
                start(async () => {
                  const r = await suggestMentorshipAction(studentId);
                  if ('error' in r && r.error) setMessage(r.error);
                  else setMatches('data' in r ? r.data : null);
                })
              }
            >
              Suggest matches
            </button>
          </div>
          {matches ? (
            <pre style={{ marginTop: 12, fontSize: '0.75rem', overflow: 'auto' }}>
              {JSON.stringify(matches, null, 2)}
            </pre>
          ) : null}
        </section>
      ) : null}

      {canWrite ? (
        <section style={panel}>
          <h2 style={{ margin: '0 0 0.75rem', fontSize: '1.1rem' }}>Newsletter</h2>
          <form
            style={{ display: 'grid', gap: 8 }}
            onSubmit={(ev) => {
              ev.preventDefault();
              const fd = new FormData(ev.currentTarget);
              start(async () => {
                const r = await sendNewsletterAction({
                  subject: String(fd.get('subject')),
                  htmlBody: String(fd.get('htmlBody')),
                });
                setMessage(r.error ?? 'Newsletter sent');
              });
            }}
          >
            <input name="subject" placeholder="Subject" style={inputStyle} required />
            <textarea
              name="htmlBody"
              placeholder="HTML body"
              style={inputStyle}
              rows={4}
              required
            />
            <button type="submit" style={btn} disabled={pending}>
              Send branded newsletter
            </button>
          </form>
        </section>
      ) : null}

      {message ? <p style={{ color: '#64748b', fontSize: '0.9rem' }}>{message}</p> : null}
    </div>
  );
}
