'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import {
  createCommitteeAction,
  createMeetingAction,
  createResolutionAction,
  fetchCommitteesAction,
  fetchResolutionsAction,
  startMeetingAction,
} from '@/app/meetings/actions';
import { MeetingsDetailPanel } from '@/components/meetings/meetings-detail-panel';

type MeetingRow = {
  id: string;
  title: string;
  type: string;
  status: string;
  scheduledAt: string;
  location?: string | null;
  meetingLink?: string | null;
  orgUnit?: { name: string };
  agendaItems?: Array<{ id: string; itemNumber: string; title: string; order: number }>;
  _count?: { attendees: number; actionItems: number };
};

type ResolutionRow = {
  id: string;
  resolutionNumber: string;
  title: string;
  outcome: string;
  meeting?: { title: string };
};

const panel: React.CSSProperties = {
  padding: '1.25rem',
  borderRadius: 12,
  border: '1px solid #e2e8f0',
  background: '#fff',
};

const btnPrimary: React.CSSProperties = {
  padding: '0.5rem 1rem',
  borderRadius: 8,
  border: 'none',
  background: '#2563eb',
  color: '#fff',
  cursor: 'pointer',
  fontWeight: 600,
};

const btnSmall: React.CSSProperties = {
  ...btnPrimary,
  padding: '0.25rem 0.6rem',
  fontSize: '0.8rem',
};

const inputStyle: React.CSSProperties = {
  padding: '0.5rem 0.75rem',
  borderRadius: 8,
  border: '1px solid #cbd5e1',
  width: '100%',
};

export function MeetingsHub({
  meetings,
  positions,
  orgUnits,
  canConvene,
  currentUserId,
}: {
  meetings: MeetingRow[];
  positions: Array<{ id: string; title: string }>;
  orgUnits: Array<{ id: string; name: string }>;
  canConvene: boolean;
  currentUserId?: string;
}) {
  const [selectedId, setSelectedId] = useState(meetings[0]?.id ?? '');
  const [resolutionQ, setResolutionQ] = useState('');
  const [resolutions, setResolutions] = useState<ResolutionRow[]>([]);
  const [committees, setCommittees] = useState<
    Array<{ id: string; name: string; isActive: boolean }>
  >([]);
  const [committeeName, setCommitteeName] = useState('');
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  const selected = meetings.find((m) => m.id === selectedId);

  const searchResolutions = () => {
    startTransition(async () => {
      const r = await fetchResolutionsAction(resolutionQ);
      setResolutions((r.data ?? []) as ResolutionRow[]);
    });
  };

  const loadCommittees = () => {
    startTransition(async () => {
      const r = await fetchCommitteesAction();
      setCommittees((r.data ?? []) as Array<{ id: string; name: string; isActive: boolean }>);
    });
  };

  return (
    <div style={{ display: 'grid', gap: '1.5rem' }}>
      {canConvene ? (
        <section style={panel}>
          <h2 style={{ margin: '0 0 0.75rem', fontSize: '1.1rem' }}>Schedule meeting</h2>
          <CreateMeetingForm
            positions={positions}
            orgUnits={orgUnits}
            pending={pending}
            onDone={(msg) => setMessage(msg)}
          />
        </section>
      ) : null}

      <p style={{ fontSize: '0.9rem' }}>
        <Link href="/meetings/inbox" style={{ color: '#2563eb' }}>
          Minutes filing inbox →
        </Link>
      </p>

      <section style={panel}>
        <h2 style={{ margin: '0 0 0.75rem', fontSize: '1.1rem' }}>Meetings</h2>
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {meetings.map((m) => (
            <li key={m.id} style={{ padding: '0.75rem 0', borderBottom: '1px solid #f1f5f9' }}>
              <button
                type="button"
                onClick={() => setSelectedId(m.id)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}
              >
                <div style={{ fontWeight: selectedId === m.id ? 700 : 500 }}>{m.title}</div>
                <div style={{ fontSize: '0.85rem', color: '#64748b' }}>
                  {m.type} · {m.status} · {new Date(m.scheduledAt).toLocaleString()}
                  {m.agendaItems?.length ? ` · ${m.agendaItems.length} agenda items` : ''}
                </div>
              </button>
              <a
                href={`/meetings/${m.id}/ical`}
                style={{ fontSize: '0.8rem', color: '#2563eb', marginLeft: 8 }}
              >
                iCal
              </a>
              {canConvene && selectedId === m.id ? (
                <button
                  type="button"
                  style={{ ...btnSmall, marginLeft: 8 }}
                  onClick={() =>
                    startTransition(async () => {
                      const r = await startMeetingAction(m.id);
                      setMessage(r.error ?? 'Meeting started.');
                    })
                  }
                >
                  Start
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      </section>

      {selected ? (
        <section style={{ ...panel, background: '#f8fafc' }}>
          <h2 style={{ fontSize: '1.1rem', marginTop: 0 }}>{selected.title}</h2>
          <MeetingsDetailPanel
            meetingId={selected.id}
            canConvene={canConvene}
            currentUserId={currentUserId}
            onMessage={setMessage}
          />
          {canConvene ? (
            <div style={{ marginTop: '1rem' }}>
              <button
                type="button"
                style={btnSmall}
                onClick={() =>
                  startTransition(async () => {
                    const r = await createResolutionAction(selected.id, {
                      title: 'Adjournment',
                      content: 'Meeting adjourned.',
                      movedBy: 'Convener',
                      secondedBy: 'Secretary',
                      votesFor: 5,
                      votesAgainst: 0,
                    });
                    setMessage(r.error ?? 'Resolution recorded.');
                  })
                }
              >
                Record sample resolution
              </button>
            </div>
          ) : null}
        </section>
      ) : null}

      {canConvene ? (
        <section style={panel}>
          <h2 style={{ fontSize: '1.1rem' }}>Committees</h2>
          <button type="button" style={btnSmall} onClick={loadCommittees}>
            Load committees
          </button>
          <div style={{ display: 'flex', gap: 8, marginTop: 8, maxWidth: 400 }}>
            <input
              style={inputStyle}
              placeholder="New committee name"
              value={committeeName}
              onChange={(e) => setCommitteeName(e.target.value)}
            />
            <button
              type="button"
              style={btnPrimary}
              disabled={!committeeName}
              onClick={() =>
                startTransition(async () => {
                  const r = await createCommitteeAction({ name: committeeName });
                  setMessage(r.error ?? 'Committee created.');
                  setCommitteeName('');
                  loadCommittees();
                })
              }
            >
              Create
            </button>
          </div>
          <ul style={{ listStyle: 'none', padding: 0, marginTop: 8 }}>
            {committees.map((c) => (
              <li key={c.id} style={{ padding: '0.35rem 0' }}>
                {c.name} {c.isActive ? '' : '(inactive)'}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section style={panel}>
        <h2 style={{ fontSize: '1.1rem' }}>Resolution register</h2>
        <div style={{ display: 'flex', gap: 8, marginBottom: 8, maxWidth: 480 }}>
          <input
            style={inputStyle}
            placeholder="Search resolutions…"
            value={resolutionQ}
            onChange={(e) => setResolutionQ(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && searchResolutions()}
          />
          <button type="button" style={btnPrimary} onClick={searchResolutions}>
            Search
          </button>
        </div>
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {resolutions.map((r) => (
            <li key={r.id} style={{ padding: '0.5rem 0', borderBottom: '1px solid #f1f5f9' }}>
              <strong>{r.resolutionNumber}</strong> — {r.title} ({r.outcome})
              {r.meeting?.title ? (
                <span style={{ fontSize: '0.8rem', color: '#64748b' }}> · {r.meeting.title}</span>
              ) : null}
            </li>
          ))}
        </ul>
        {resolutions.length === 0 ? (
          <p style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Search to load resolutions.</p>
        ) : null}
      </section>

      {message ? <p style={{ color: '#334155' }}>{message}</p> : null}
    </div>
  );
}

function CreateMeetingForm({
  positions,
  orgUnits,
  pending,
  onDone,
}: {
  positions: Array<{ id: string; title: string }>;
  orgUnits: Array<{ id: string; name: string }>;
  pending: boolean;
  onDone: (msg: string) => void;
}) {
  const [title, setTitle] = useState('');
  const [type, setType] = useState('FACULTY_BOARD');
  const [positionId, setPositionId] = useState(positions[0]?.id ?? '');
  const [orgUnitId, setOrgUnitId] = useState(orgUnits[0]?.id ?? '');
  const [scheduledAt, setScheduledAt] = useState(
    new Date(Date.now() + 86_400_000).toISOString().slice(0, 16),
  );

  return (
    <form
      style={{ display: 'grid', gap: 8, maxWidth: 520 }}
      onSubmit={(e) => {
        e.preventDefault();
        void createMeetingAction({
          title,
          type,
          convenerPositionId: positionId,
          orgUnitId,
          scheduledAt,
        }).then((r) => onDone(r.error ?? 'Meeting scheduled.'));
      }}
    >
      <input
        style={inputStyle}
        required
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Title"
      />
      <select style={inputStyle} value={type} onChange={(e) => setType(e.target.value)}>
        <option value="SENATE">Senate</option>
        <option value="ACADEMIC_BOARD">Academic Board</option>
        <option value="FACULTY_BOARD">Faculty Board</option>
        <option value="DEPARTMENTAL">Departmental</option>
        <option value="COMMITTEE">Committee</option>
      </select>
      <select style={inputStyle} value={positionId} onChange={(e) => setPositionId(e.target.value)}>
        {positions.map((p) => (
          <option key={p.id} value={p.id}>
            {p.title}
          </option>
        ))}
      </select>
      <select style={inputStyle} value={orgUnitId} onChange={(e) => setOrgUnitId(e.target.value)}>
        {orgUnits.map((u) => (
          <option key={u.id} value={u.id}>
            {u.name}
          </option>
        ))}
      </select>
      <input
        style={inputStyle}
        type="datetime-local"
        value={scheduledAt}
        onChange={(e) => setScheduledAt(e.target.value)}
      />
      <button type="submit" style={btnPrimary} disabled={pending || !positionId || !orgUnitId}>
        Create meeting
      </button>
    </form>
  );
}
