'use client';

import { useCallback, useEffect, useState, useTransition } from 'react';
import {
  addAgendaItemAction,
  approveMinutesAction,
  createActionItemAction,
  deleteAgendaItemAction,
  fetchMeetingDetailAction,
  generateMinutesAction,
  inviteAttendeeAction,
  markAttendanceAction,
  rsvpMeetingAction,
  updateActionItemStatusAction,
  updateAgendaItemAction,
} from '@/app/meetings/actions';
import { MeetingsAgendaDnd } from '@/components/meetings/meetings-agenda-dnd';
import { ZoomMeetingEmbed } from '@/components/meetings/zoom-meeting-embed';
import { fetchZoomSdkAction } from '@/app/meetings/actions';
import { StaffUserPicker } from '@/components/staff/staff-user-picker';

type AgendaItem = { id: string; itemNumber: string; title: string; order: number };
type Attendee = {
  id: string;
  userId: string;
  inviteStatus: string;
  attended: boolean | null;
  isRequired: boolean;
  user: { id: string; email: string; profile?: unknown };
};
type ActionItem = {
  id: string;
  description: string;
  status: string;
  dueDate: string | null;
};
type MeetingDetail = {
  id: string;
  title: string;
  status: string;
  quorumRequired: number;
  quorumMet: boolean | null;
  meetingLink?: string | null;
  agendaItems: AgendaItem[];
  attendees: Attendee[];
  actionItems: ActionItem[];
  minutesDraft?: unknown;
};

const inputStyle: React.CSSProperties = {
  padding: '0.5rem 0.75rem',
  borderRadius: 8,
  border: '1px solid #cbd5e1',
  width: '100%',
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

function attendeeName(a: Attendee) {
  const p = a.user.profile as { firstName?: string; lastName?: string } | undefined;
  if (p?.firstName || p?.lastName) return `${p.firstName ?? ''} ${p.lastName ?? ''}`.trim();
  return a.user.email;
}

export function MeetingsDetailPanel({
  meetingId,
  canConvene,
  currentUserId,
  onMessage,
}: {
  meetingId: string;
  canConvene: boolean;
  currentUserId?: string;
  onMessage: (msg: string) => void;
}) {
  const [detail, setDetail] = useState<MeetingDetail | null>(null);
  const [agendaTitle, setAgendaTitle] = useState('');
  const [transcript, setTranscript] = useState('');
  const [minutesPreview, setMinutesPreview] = useState<string | null>(null);
  const [actionDesc, setActionDesc] = useState('');
  const [inviteUserId, setInviteUserId] = useState('');
  const [, startTransition] = useTransition();

  const reload = useCallback(() => {
    startTransition(async () => {
      const r = await fetchMeetingDetailAction(meetingId);
      if ('error' in r) onMessage(r.error);
      else setDetail(r.data as MeetingDetail);
    });
  }, [meetingId, onMessage]);

  useEffect(() => {
    reload();
  }, [reload]);

  if (!detail) {
    return <p style={{ color: '#64748b', fontSize: '0.9rem' }}>Loading meeting details…</p>;
  }

  return (
    <div style={{ display: 'grid', gap: '1.25rem' }}>
      <div style={{ fontSize: '0.85rem', color: '#64748b' }}>
        {detail.status}
        {detail.meetingLink ? (
          <>
            {' · '}
            <a
              href={detail.meetingLink}
              target="_blank"
              rel="noreferrer"
              style={{ color: '#2563eb' }}
            >
              Join online
            </a>
          </>
        ) : null}
        {detail.quorumRequired > 0 ? (
          <span>
            {' · '}
            Quorum: {detail.quorumRequired} ({detail.quorumMet ? 'met' : 'not met'})
          </span>
        ) : null}
      </div>

      {detail.meetingLink && /zoom\.us/i.test(detail.meetingLink) ? (
        <ZoomMeetingEmbed
          meetingId={meetingId}
          meetingLink={detail.meetingLink}
          fetchSdk={async (id) => fetchZoomSdkAction(id)}
        />
      ) : null}

      <section>
        <h3 style={{ fontSize: '1rem', margin: '0 0 0.5rem' }}>Agenda</h3>
        {canConvene ? (
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <input
              style={inputStyle}
              placeholder="New agenda item"
              value={agendaTitle}
              onChange={(e) => setAgendaTitle(e.target.value)}
            />
            <button
              type="button"
              style={btnPrimary}
              disabled={!agendaTitle}
              onClick={() =>
                startTransition(async () => {
                  const n = detail.agendaItems.length + 1;
                  const r = await addAgendaItemAction(meetingId, {
                    itemNumber: String(n),
                    title: agendaTitle,
                  });
                  onMessage(r.error ?? 'Agenda item added.');
                  setAgendaTitle('');
                  reload();
                })
              }
            >
              Add
            </button>
          </div>
        ) : null}
        {detail.agendaItems.length > 0 ? (
          <>
            {canConvene ? (
              <MeetingsAgendaDnd
                meetingId={meetingId}
                items={detail.agendaItems}
                onReordered={reload}
              />
            ) : (
              <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
                {detail.agendaItems.map((item) => (
                  <li key={item.id} style={{ padding: '0.35rem 0' }}>
                    {item.itemNumber}. {item.title}
                  </li>
                ))}
              </ul>
            )}
            {canConvene ? (
              <ul style={{ margin: '0.75rem 0 0', padding: 0, listStyle: 'none' }}>
                {detail.agendaItems.map((item) => (
                  <li
                    key={`edit-${item.id}`}
                    style={{
                      display: 'flex',
                      gap: 6,
                      alignItems: 'center',
                      marginTop: 6,
                      fontSize: '0.85rem',
                    }}
                  >
                    <span style={{ minWidth: 48 }}>{item.itemNumber}</span>
                    <input
                      style={{ ...inputStyle, flex: 1 }}
                      defaultValue={item.title}
                      onBlur={(e) => {
                        if (e.target.value === item.title) return;
                        startTransition(async () => {
                          const r = await updateAgendaItemAction(meetingId, item.id, {
                            title: e.target.value,
                          });
                          onMessage(r.error ?? 'Updated.');
                          reload();
                        });
                      }}
                    />
                    <button
                      type="button"
                      style={{ ...btnSmall, background: '#b91c1c' }}
                      onClick={() =>
                        startTransition(async () => {
                          const r = await deleteAgendaItemAction(meetingId, item.id);
                          onMessage(r.error ?? 'Removed.');
                          reload();
                        })
                      }
                    >
                      Delete
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </>
        ) : (
          <p style={{ color: '#94a3b8', fontSize: '0.85rem' }}>No agenda items yet.</p>
        )}
      </section>

      <section>
        <h3 style={{ fontSize: '1rem', margin: '0 0 0.5rem' }}>Attendees</h3>
        {canConvene ? (
          <div style={{ marginBottom: 8, maxWidth: 400 }}>
            <StaffUserPicker name="inviteUserId" onSelect={(u) => setInviteUserId(u.id)} />
            <button
              type="button"
              style={{ ...btnSmall, marginTop: 6 }}
              disabled={!inviteUserId}
              onClick={() =>
                startTransition(async () => {
                  const r = await inviteAttendeeAction(meetingId, { userId: inviteUserId });
                  onMessage(r.error ?? 'Invited.');
                  reload();
                })
              }
            >
              Send invite
            </button>
          </div>
        ) : null}
        <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
          {detail.attendees.map((a) => (
            <li
              key={a.id}
              style={{
                padding: '0.4rem 0',
                borderBottom: '1px solid #f1f5f9',
                display: 'flex',
                flexWrap: 'wrap',
                gap: 8,
                alignItems: 'center',
              }}
            >
              <span>{attendeeName(a)}</span>
              <span style={{ fontSize: '0.75rem', color: '#64748b' }}>{a.inviteStatus}</span>
              {a.attended ? (
                <span style={{ fontSize: '0.75rem', color: '#15803d' }}>Present</span>
              ) : null}
              {!canConvene && currentUserId && a.userId === currentUserId ? (
                <span style={{ display: 'flex', gap: 4 }}>
                  {(['ACCEPTED', 'DECLINED', 'TENTATIVE'] as const).map((s) => (
                    <button
                      key={s}
                      type="button"
                      style={btnSmall}
                      onClick={() =>
                        startTransition(async () => {
                          const r = await rsvpMeetingAction(meetingId, s);
                          onMessage(r.error ?? `RSVP: ${s}`);
                          reload();
                        })
                      }
                    >
                      {s}
                    </button>
                  ))}
                </span>
              ) : null}
              {canConvene ? (
                <button
                  type="button"
                  style={btnSmall}
                  onClick={() =>
                    startTransition(async () => {
                      const r = await markAttendanceAction(meetingId, {
                        userId: a.userId,
                        attended: !a.attended,
                      });
                      onMessage(r.error ?? 'Attendance updated.');
                      reload();
                    })
                  }
                >
                  {a.attended ? 'Mark absent' : 'Mark present'}
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h3 style={{ fontSize: '1rem', margin: '0 0 0.5rem' }}>Action items</h3>
        {canConvene ? (
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <input
              style={inputStyle}
              placeholder="Action description"
              value={actionDesc}
              onChange={(e) => setActionDesc(e.target.value)}
            />
            <button
              type="button"
              style={btnPrimary}
              disabled={!actionDesc}
              onClick={() =>
                startTransition(async () => {
                  const r = await createActionItemAction(meetingId, { description: actionDesc });
                  onMessage(r.error ?? 'Action item created.');
                  setActionDesc('');
                  reload();
                })
              }
            >
              Add
            </button>
          </div>
        ) : null}
        <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
          {detail.actionItems.map((ai) => (
            <li key={ai.id} style={{ padding: '0.4rem 0', fontSize: '0.9rem' }}>
              {ai.description} <span style={{ color: '#64748b' }}>({ai.status})</span>
              {canConvene && ai.status !== 'COMPLETED' ? (
                <button
                  type="button"
                  style={{ ...btnSmall, marginLeft: 8 }}
                  onClick={() =>
                    startTransition(async () => {
                      const r = await updateActionItemStatusAction(ai.id, 'COMPLETED');
                      onMessage(r.error ?? 'Marked complete.');
                      reload();
                    })
                  }
                >
                  Complete
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      </section>

      {canConvene ? (
        <section>
          <h3 style={{ fontSize: '1rem', margin: '0 0 0.5rem' }}>AI minutes</h3>
          <textarea
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            rows={5}
            style={{ ...inputStyle, fontFamily: 'inherit' }}
            placeholder="Paste transcript…"
          />
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button
              type="button"
              style={btnPrimary}
              disabled={transcript.length < 20}
              onClick={() =>
                startTransition(async () => {
                  const r = await generateMinutesAction(meetingId, transcript);
                  if (r.error) onMessage(r.error);
                  else {
                    setMinutesPreview(r.plainText ?? '');
                    onMessage('Draft minutes saved.');
                    reload();
                  }
                })
              }
            >
              Generate
            </button>
            <button
              type="button"
              style={btnSmall}
              onClick={() =>
                startTransition(async () => {
                  const r = await approveMinutesAction(meetingId);
                  onMessage(r.error ?? 'Minutes approved.');
                })
              }
            >
              Approve & file
            </button>
          </div>
          {minutesPreview ? (
            <>
              <pre style={{ marginTop: 12, fontSize: '0.85rem', whiteSpace: 'pre-wrap' }}>
                {minutesPreview}
              </pre>
              <p style={{ marginTop: 8, fontSize: '0.85rem' }}>
                <a
                  href={`/meetings/${meetingId}/minutes.pdf`}
                  style={{ color: '#2563eb', marginRight: 12 }}
                >
                  PDF
                </a>
                <a href={`/meetings/${meetingId}/minutes.docx`} style={{ color: '#2563eb' }}>
                  Word (.docx)
                </a>
              </p>
            </>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
