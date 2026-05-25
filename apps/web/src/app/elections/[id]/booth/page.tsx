'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';

const apiBase = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

const BOOTH_KEY = 'unicore_election_booth';

type BoothCredential = {
  electionId: string;
  ballotToken: string;
  ballotSignature: string;
  blindRsaSignature?: string;
};

type BallotData = {
  positions: Array<{ title: string }>;
  candidates: Array<{ id: string; position: string; displayName: string }>;
};

export default function ElectionBoothPage() {
  const params = useParams();
  const electionId = String(params.id);
  const [credential, setCredential] = useState<BoothCredential | null>(null);
  const [ballot, setBallot] = useState<BallotData | null>(null);
  const [choices, setChoices] = useState<Record<string, string>>({});
  const [verifyToken, setVerifyToken] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(BOOTH_KEY);
      if (!raw) {
        setMessage('No booth credential. Issue one from the elections hub first.');
        return;
      }
      const parsed = JSON.parse(raw) as BoothCredential;
      if (parsed.electionId !== electionId) {
        setMessage('Booth credential is for a different election.');
        return;
      }
      setCredential(parsed);
      startTransition(async () => {
        const res = await fetch(
          `${apiBase}/elections/${encodeURIComponent(electionId)}/booth/ballot`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              ballotToken: parsed.ballotToken,
              ballotSignature: parsed.ballotSignature,
            }),
          },
        );
        if (!res.ok) {
          setMessage(`Ballot unavailable: ${await res.text()}`);
          return;
        }
        setBallot((await res.json()) as BallotData);
      });
    } catch {
      setMessage('Invalid booth session.');
    }
  }, [electionId]);

  const castVote = () => {
    if (!credential?.blindRsaSignature) {
      setMessage('Missing RSA blind endorsement. Re-enter the booth from the elections hub.');
      return;
    }
    if (!credential) return;
    const choiceList = Object.entries(choices).map(([position, candidateId]) => ({
      position,
      candidateId,
    }));
    startTransition(async () => {
      const res = await fetch(`${apiBase}/elections/${encodeURIComponent(electionId)}/booth/cast`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ballotToken: credential.ballotToken,
          ballotSignature: credential.ballotSignature,
          blindRsaSignature: credential.blindRsaSignature,
          choices: choiceList,
        }),
      });
      if (!res.ok) {
        setMessage(`Vote failed: ${await res.text()}`);
        return;
      }
      const body = (await res.json()) as { verificationToken?: string };
      sessionStorage.removeItem(BOOTH_KEY);
      setCredential(null);
      setBallot(null);
      setVerifyToken(body.verificationToken ?? null);
      setMessage('Vote recorded anonymously. You may close this window.');
    });
  };

  return (
    <main
      style={{
        minHeight: '100vh',
        background: '#0f172a',
        color: '#f8fafc',
        padding: '2rem',
        fontFamily: 'system-ui',
        maxWidth: 560,
        margin: '0 auto',
      }}
    >
      <p style={{ marginTop: 0 }}>
        <Link href="/dashboard/elections" style={{ color: '#93c5fd' }}>
          ← Elections
        </Link>
      </p>
      <h1 style={{ marginTop: 0 }}>Blind voting booth</h1>
      <p style={{ color: '#94a3b8', fontSize: '0.9rem' }}>
        One-time credential session. Candidate labels are anonymized in this booth view.
      </p>
      {message ? <p style={{ color: verifyToken ? '#86efac' : '#fca5a5' }}>{message}</p> : null}
      {credential && ballot && !verifyToken ? (
        <div style={{ marginTop: '1.5rem', display: 'grid', gap: '1.25rem' }}>
          {ballot.positions.map((pos) => (
            <div key={pos.title}>
              <strong>{pos.title}</strong>
              {ballot.candidates
                .filter((c) => c.position === pos.title)
                .map((c) => (
                  <label
                    key={c.id}
                    style={{ display: 'flex', gap: 8, marginTop: 8, cursor: 'pointer' }}
                  >
                    <input
                      type="radio"
                      name={pos.title}
                      checked={choices[pos.title] === c.id}
                      onChange={() => setChoices((p) => ({ ...p, [pos.title]: c.id }))}
                    />
                    {c.displayName}
                  </label>
                ))}
            </div>
          ))}
          <button
            type="button"
            onClick={castVote}
            disabled={pending || Object.keys(choices).length !== ballot.positions.length}
            style={{
              padding: '0.6rem 1.2rem',
              borderRadius: 8,
              border: 'none',
              background: '#16a34a',
              color: '#fff',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Cast anonymous vote
          </button>
        </div>
      ) : null}
      {verifyToken ? (
        <p style={{ wordBreak: 'break-all', fontSize: '0.85rem', marginTop: '1.5rem' }}>
          Verification token: <code>{verifyToken}</code>
        </p>
      ) : null}
    </main>
  );
}
