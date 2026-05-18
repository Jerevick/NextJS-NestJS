'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState, useTransition } from 'react';
import { StaffUserPicker } from '@/components/staff/staff-user-picker';
import { ElectionBoothEntryButton } from '@/components/elections/election-booth-entry';
import {
  castVoteAction,
  uploadCandidatePhotoAction,
  uploadElectionManifestoAction,
  createElectionAction,
  fetchAdminResultsAction,
  fetchBallotAction,
  fetchCandidatesAction,
  fetchElectionAuditAction,
  fetchPublicResultsAction,
  nominateCandidateAction,
  publishElectionResultsAction,
  reviewCandidateAction,
  startCertificationAction,
  syncElectionLifecycleAction,
  updateElectionStatusAction,
} from '@/app/elections/actions';

type ElectionRow = {
  id: string;
  title: string;
  status: string;
  scope?: string;
  votingOpenDate: string;
  votingCloseDate: string;
  positions: Array<{ title: string }>;
};

type CandidateRow = {
  id: string;
  position: string;
  status: string;
  manifesto: string;
  photoUrl?: string | null;
  user: { id: string; email: string; profile?: unknown };
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
  fontSize: '0.95rem',
  width: '100%',
};

export function ElectionsHub({
  elections,
  canManage,
}: {
  elections: ElectionRow[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState(elections[0]?.id ?? '');
  const [candidates, setCandidates] = useState<CandidateRow[]>([]);
  const [ballot, setBallot] = useState<{
    positions: Array<{ title: string }>;
    candidates: Array<{ id: string; position: string; manifesto: string; user: { name: string } }>;
  } | null>(null);
  const [choices, setChoices] = useState<Record<string, string>>({});
  const [resultsJson, setResultsJson] = useState<string | null>(null);
  const [auditLines, setAuditLines] = useState<Array<{ action: string; createdAt: string }>>([]);
  const [verifyToken, setVerifyToken] = useState<string | null>(null);
  const [nomineeUserId, setNomineeUserId] = useState('');
  const [nomineePosition, setNomineePosition] = useState('President');
  const [nomineeManifesto, setNomineeManifesto] = useState('');
  const [secondedBy, setSecondedBy] = useState('');
  const [manifestoDocKey, setManifestoDocKey] = useState<string | undefined>();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  const selected = useMemo(
    () => elections.find((e) => e.id === selectedId),
    [elections, selectedId],
  );

  const loadCandidates = () => {
    if (!selectedId) return;
    startTransition(async () => {
      const r = await fetchCandidatesAction(selectedId);
      if ('error' in r) setMessage(r.error);
      else setCandidates(r.data as CandidateRow[]);
    });
  };

  return (
    <div style={{ display: 'grid', gap: '1.5rem' }}>
      {canManage ? (
        <section style={panel}>
          <h2 style={{ margin: '0 0 0.75rem', fontSize: '1.1rem' }}>Create election</h2>
          <CreateElectionForm pending={pending} onCreated={(msg) => setMessage(msg)} />
        </section>
      ) : null}

      <section style={panel}>
        <h2 style={{ margin: '0 0 0.75rem', fontSize: '1.1rem' }}>Elections</h2>
        {elections.length === 0 ? (
          <p style={{ color: '#64748b', margin: 0 }}>No elections yet.</p>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {elections.map((e) => (
              <li
                key={e.id}
                style={{
                  padding: '0.75rem 0',
                  borderBottom: '1px solid #f1f5f9',
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '0.5rem',
                  alignItems: 'center',
                }}
              >
                <button
                  type="button"
                  onClick={() => {
                    setSelectedId(e.id);
                    setBallot(null);
                    setResultsJson(null);
                    setCandidates([]);
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    fontWeight: selectedId === e.id ? 700 : 500,
                  }}
                >
                  {e.title}
                </button>
                <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                  {e.status}
                  {e.scope === 'INSTITUTION' ? ' · institution-wide' : ''}
                </span>
                {canManage ? (
                  <>
                    <button
                      type="button"
                      style={btnSmall}
                      disabled={pending}
                      onClick={() =>
                        startTransition(async () => {
                          await syncElectionLifecycleAction(e.id);
                          setMessage('Lifecycle synced to calendar dates.');
                        })
                      }
                    >
                      Sync dates
                    </button>
                    <button
                      type="button"
                      style={btnSmall}
                      disabled={pending}
                      onClick={() =>
                        startTransition(async () => {
                          await updateElectionStatusAction(e.id, 'VOTING_OPEN');
                          setMessage('Voting opened.');
                        })
                      }
                    >
                      Open voting
                    </button>
                    <button
                      type="button"
                      style={btnSmall}
                      disabled={pending}
                      onClick={() =>
                        startTransition(async () => {
                          await startCertificationAction(e.id);
                          setMessage('Certification workflow started.');
                        })
                      }
                    >
                      Certify
                    </button>
                    <button
                      type="button"
                      style={btnSmall}
                      disabled={pending}
                      onClick={() =>
                        startTransition(async () => {
                          await publishElectionResultsAction(e.id);
                          setMessage('Results published.');
                        })
                      }
                    >
                      Publish
                    </button>
                  </>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      {selected ? (
        <>
          <section style={{ ...panel, background: '#f8fafc' }}>
            <h2 style={{ fontSize: '1.1rem' }}>Voting booth — {selected.title}</h2>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', margin: '0.75rem 0' }}>
              <button
                type="button"
                style={btnPrimary}
                disabled={pending}
                onClick={() => {
                  startTransition(async () => {
                    const r = await fetchBallotAction(selected.id);
                    if ('error' in r) setMessage(r.error);
                    else {
                      setBallot(r.data as typeof ballot);
                      setChoices({});
                    }
                  });
                }}
              >
                Load ballot
              </button>
              <ElectionBoothEntryButton
                electionId={selected.id}
                disabled={pending}
                style={{ ...btnSmall, background: '#0f172a' }}
              />
              <Link
                href="/elections/inbox"
                style={{ fontSize: '0.85rem', color: '#2563eb', alignSelf: 'center' }}
              >
                Certification inbox →
              </Link>
              <Link
                href="/elections/verify"
                style={{ fontSize: '0.85rem', color: '#2563eb', alignSelf: 'center' }}
              >
                Verify vote →
              </Link>
              {selected.status === 'PUBLISHED' ||
              selected.status === 'VOTING_OPEN' ||
              selected.status === 'VOTING_CLOSED' ? (
                <button
                  type="button"
                  style={btnSmall}
                  disabled={pending}
                  onClick={() => {
                    startTransition(async () => {
                      const r =
                        selected.status === 'PUBLISHED'
                          ? await fetchPublicResultsAction(selected.id)
                          : canManage &&
                              (selected.status === 'VOTING_OPEN' ||
                                selected.status === 'VOTING_CLOSED')
                            ? await fetchAdminResultsAction(selected.id)
                            : await fetchPublicResultsAction(selected.id);
                      if ('error' in r) setMessage(r.error);
                      else setResultsJson(JSON.stringify(r.data, null, 2));
                    });
                  }}
                >
                  {selected.status === 'PUBLISHED' ? 'View results' : 'Live tallies'}
                </button>
              ) : null}
            </div>
            {ballot ? (
              <div style={{ display: 'grid', gap: '1rem' }}>
                {ballot.positions.map((pos) => (
                  <div key={pos.title}>
                    <strong>{pos.title}</strong>
                    {ballot.candidates
                      .filter((c) => c.position === pos.title)
                      .map((c) => (
                        <label key={c.id} style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                          <input
                            type="radio"
                            name={pos.title}
                            checked={choices[pos.title] === c.id}
                            onChange={() => setChoices((p) => ({ ...p, [pos.title]: c.id }))}
                          />
                          {c.user.name}
                        </label>
                      ))}
                  </div>
                ))}
                <button
                  type="button"
                  style={btnPrimary}
                  disabled={pending}
                  onClick={() => {
                    const choiceList = Object.entries(choices).map(([position, candidateId]) => ({
                      position,
                      candidateId,
                    }));
                    startTransition(async () => {
                      const r = await castVoteAction(selected.id, choiceList);
                      if (r.error) setMessage(r.error);
                      else {
                        setVerifyToken(r.verificationToken ?? null);
                        setMessage('Vote recorded.');
                      }
                    });
                  }}
                >
                  Cast vote
                </button>
                {verifyToken ? (
                  <p style={{ fontSize: '0.85rem', wordBreak: 'break-all' }}>
                    Verification: <code>{verifyToken}</code>
                  </p>
                ) : null}
              </div>
            ) : null}
            {resultsJson ? (
              <pre style={{ marginTop: '1rem', fontSize: '0.8rem', overflow: 'auto' }}>
                {resultsJson}
              </pre>
            ) : null}
          </section>

          <section style={panel}>
            <h2 style={{ fontSize: '1.1rem' }}>Nominations & candidates</h2>
            <div style={{ display: 'grid', gap: 8, maxWidth: 480, marginBottom: 12 }}>
              <StaffUserPicker name="nomineeUserId" onSelect={(u) => setNomineeUserId(u.id)} />
              <input
                style={inputStyle}
                placeholder="Position"
                value={nomineePosition}
                onChange={(e) => setNomineePosition(e.target.value)}
              />
              <input
                style={inputStyle}
                placeholder="Seconded by"
                value={secondedBy}
                onChange={(e) => setSecondedBy(e.target.value)}
              />
              <textarea
                style={{ ...inputStyle, fontFamily: 'inherit' }}
                placeholder="Manifesto text"
                rows={3}
                value={nomineeManifesto}
                onChange={(e) => setNomineeManifesto(e.target.value)}
              />
              <label style={{ fontSize: '0.85rem' }}>
                Manifesto file
                <input
                  type="file"
                  accept=".pdf,image/*"
                  style={{ display: 'block', marginTop: 4 }}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    const fd = new FormData();
                    fd.append('file', f);
                    startTransition(async () => {
                      const r = await uploadElectionManifestoAction(selected.id, fd);
                      if (r.error) setMessage(r.error);
                      else {
                        setManifestoDocKey(r.manifestoDocKey);
                        setMessage('Manifesto file ready.');
                      }
                    });
                  }}
                />
              </label>
              <button
                type="button"
                style={btnPrimary}
                disabled={pending || !nomineeUserId}
                onClick={() =>
                  startTransition(async () => {
                    const r = await nominateCandidateAction(selected.id, {
                      userId: nomineeUserId,
                      position: nomineePosition,
                      manifesto: nomineeManifesto,
                      manifestoDocKey,
                      secondedBy: secondedBy || undefined,
                    });
                    setMessage(r.error ?? 'Nomination submitted.');
                    loadCandidates();
                  })
                }
              >
                Submit nomination
              </button>
            </div>
            <button type="button" style={btnSmall} onClick={loadCandidates}>
              Refresh candidates
            </button>
            <ul style={{ listStyle: 'none', padding: 0, marginTop: 12 }}>
              {candidates.map((c) => (
                <li key={c.id} style={{ padding: '0.5rem 0', borderBottom: '1px solid #f1f5f9' }}>
                  {c.photoUrl ? (
                    <img
                      src={c.photoUrl}
                      alt=""
                      width={32}
                      height={32}
                      style={{ borderRadius: '50%', marginRight: 8, verticalAlign: 'middle' }}
                    />
                  ) : null}
                  <strong>{c.position}</strong> — {c.user.email} ({c.status})
                  <label style={{ marginLeft: 8, fontSize: '0.75rem' }}>
                    Photo
                    <input
                      type="file"
                      accept="image/*"
                      style={{ display: 'block' }}
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (!f) return;
                        const fd = new FormData();
                        fd.append('file', f);
                        startTransition(async () => {
                          const r = await uploadCandidatePhotoAction(selected.id, c.id, fd);
                          setMessage(r.error ?? 'Photo uploaded.');
                          loadCandidates();
                        });
                      }}
                    />
                  </label>
                  {canManage && c.status === 'PENDING' ? (
                    <span style={{ marginLeft: 8 }}>
                      <button
                        type="button"
                        style={btnSmall}
                        onClick={() =>
                          startTransition(async () => {
                            await reviewCandidateAction(selected.id, c.id, 'APPROVED');
                            loadCandidates();
                          })
                        }
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        style={{ ...btnSmall, background: '#b91c1c' }}
                        onClick={() =>
                          startTransition(async () => {
                            await reviewCandidateAction(selected.id, c.id, 'REJECTED');
                            loadCandidates();
                          })
                        }
                      >
                        Reject
                      </button>
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>

          {canManage ? (
            <section style={panel}>
              <h2 style={{ fontSize: '1.1rem' }}>Management audit</h2>
              <button
                type="button"
                style={btnSmall}
                onClick={() =>
                  startTransition(async () => {
                    const r = await fetchElectionAuditAction(selected.id);
                    if ('error' in r) setMessage(r.error);
                    else
                      setAuditLines((r.data as Array<{ action: string; createdAt: string }>) ?? []);
                  })
                }
              >
                Load audit log
              </button>
              <ul style={{ marginTop: 12, fontSize: '0.85rem' }}>
                {auditLines.map((line, i) => (
                  <li key={i}>
                    {new Date(line.createdAt).toLocaleString()} — {line.action}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </>
      ) : null}

      {message ? (
        <p role="status" style={{ color: '#334155', fontSize: '0.9rem' }}>
          {message}
        </p>
      ) : null}
    </div>
  );
}

function CreateElectionForm({
  pending,
  onCreated,
}: {
  pending: boolean;
  onCreated: (msg: string) => void;
}) {
  const [title, setTitle] = useState('');
  const [scope, setScope] = useState<'ENTITY' | 'INSTITUTION'>('ENTITY');
  const [positionTitle, setPositionTitle] = useState('President');
  const now = new Date();
  const iso = (d: Date) => d.toISOString().slice(0, 16);

  return (
    <form
      style={{ display: 'grid', gap: 8, maxWidth: 480 }}
      onSubmit={(e) => {
        e.preventDefault();
        void createElectionAction({
          title,
          scope,
          positions: [{ title: positionTitle }],
          nominationOpenDate: iso(now),
          nominationCloseDate: iso(new Date(now.getTime() + 7 * 86_400_000)),
          votingOpenDate: iso(new Date(now.getTime() + 8 * 86_400_000)),
          votingCloseDate: iso(new Date(now.getTime() + 14 * 86_400_000)),
        }).then((r) => onCreated(r.error ?? 'Election created.'));
      }}
    >
      <input
        style={inputStyle}
        required
        placeholder="Title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />
      <select
        style={inputStyle}
        value={scope}
        onChange={(e) => setScope(e.target.value as 'ENTITY' | 'INSTITUTION')}
      >
        <option value="ENTITY">Entity-scoped</option>
        <option value="INSTITUTION">Institution-wide</option>
      </select>
      <input
        style={inputStyle}
        value={positionTitle}
        onChange={(e) => setPositionTitle(e.target.value)}
      />
      <button type="submit" style={btnPrimary} disabled={pending}>
        Create draft
      </button>
    </form>
  );
}
