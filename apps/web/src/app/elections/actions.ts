'use server';

import { revalidatePath } from 'next/cache';
import { auth } from '@/auth';
import { apiBase, buildApiHeaders } from '@/lib/server-api';

export async function createElectionAction(input: {
  title: string;
  description?: string;
  scope?: 'ENTITY' | 'INSTITUTION';
  positions: Array<{ title: string; description?: string }>;
  nominationOpenDate: string;
  nominationCloseDate: string;
  votingOpenDate: string;
  votingCloseDate: string;
}): Promise<{ error?: string; ok?: boolean }> {
  const session = await auth();
  if (!session?.accessToken) return { error: 'Not signed in.' };
  const res = await fetch(`${apiBase}/elections`, {
    method: 'POST',
    headers: { ...buildApiHeaders(session), 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
    cache: 'no-store',
  });
  if (!res.ok) return { error: `Create failed (${res.status}): ${await res.text()}` };
  revalidatePath('/elections');
  return { ok: true };
}

export async function fetchCandidatesAction(electionId: string) {
  const session = await auth();
  if (!session?.accessToken) return { error: 'Not signed in.' as const };
  const res = await fetch(`${apiBase}/elections/${encodeURIComponent(electionId)}/candidates`, {
    headers: buildApiHeaders(session),
    cache: 'no-store',
  });
  if (!res.ok) return { error: `Failed (${res.status})` as const };
  return { data: ((await res.json()) as { data?: unknown[] }).data ?? [] };
}

export async function reviewCandidateAction(
  electionId: string,
  candidateId: string,
  status: 'APPROVED' | 'REJECTED',
  rejectionReason?: string,
) {
  const session = await auth();
  if (!session?.accessToken) return { error: 'Not signed in.' };
  const res = await fetch(
    `${apiBase}/elections/${encodeURIComponent(electionId)}/candidates/${encodeURIComponent(candidateId)}`,
    {
      method: 'PATCH',
      headers: { ...buildApiHeaders(session), 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, rejectionReason }),
      cache: 'no-store',
    },
  );
  if (!res.ok) return { error: `Review failed (${res.status})` };
  revalidatePath('/elections');
  return { ok: true };
}

export async function uploadElectionManifestoAction(electionId: string, formData: FormData) {
  const session = await auth();
  if (!session?.accessToken) return { error: 'Not signed in.' };
  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) return { error: 'Choose a file.' };
  const body = new FormData();
  body.append('file', file);
  const res = await fetch(
    `${apiBase}/elections/${encodeURIComponent(electionId)}/manifesto-upload`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.accessToken}`,
        'X-Institution-ID': session.user.institutionId,
        ...(session.user.entityId ? { 'X-Entity-ID': session.user.entityId } : {}),
      },
      body,
      cache: 'no-store',
    },
  );
  if (!res.ok) return { error: `Upload failed (${res.status})` };
  return (await res.json()) as { manifestoDocKey: string; downloadUrl?: string | null };
}

export async function uploadCandidatePhotoAction(
  electionId: string,
  candidateId: string,
  formData: FormData,
) {
  const session = await auth();
  if (!session?.accessToken) return { error: 'Not signed in.' };
  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) return { error: 'Choose a photo.' };
  const body = new FormData();
  body.append('file', file);
  const res = await fetch(
    `${apiBase}/elections/${encodeURIComponent(electionId)}/candidates/${encodeURIComponent(candidateId)}/photo`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.accessToken}`,
        'X-Institution-ID': session.user.institutionId,
        ...(session.user.entityId ? { 'X-Entity-ID': session.user.entityId } : {}),
      },
      body,
      cache: 'no-store',
    },
  );
  if (!res.ok) return { error: `Photo upload failed (${res.status})` };
  revalidatePath('/elections');
  return { ok: true as const };
}

export async function verifyVoteTokenAction(token: string) {
  const res = await fetch(`${apiBase}/elections/verify/${encodeURIComponent(token)}`, {
    cache: 'no-store',
  });
  if (!res.ok) return { error: `Not found (${res.status})` as const };
  return { data: await res.json() };
}

export async function nominateCandidateAction(
  electionId: string,
  input: {
    userId: string;
    position: string;
    manifesto?: string;
    manifestoDocKey?: string;
    secondedBy?: string;
  },
) {
  const session = await auth();
  if (!session?.accessToken) return { error: 'Not signed in.' };
  const res = await fetch(`${apiBase}/elections/${encodeURIComponent(electionId)}/nominations`, {
    method: 'POST',
    headers: { ...buildApiHeaders(session), 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
    cache: 'no-store',
  });
  if (!res.ok) return { error: `Nomination failed (${res.status}): ${await res.text()}` };
  revalidatePath('/elections');
  return { ok: true };
}

export async function updateElectionStatusAction(id: string, status: string) {
  const session = await auth();
  if (!session?.accessToken) return { error: 'Not signed in.' };
  const res = await fetch(`${apiBase}/elections/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { ...buildApiHeaders(session), 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
    cache: 'no-store',
  });
  if (!res.ok) return { error: `Update failed (${res.status})` };
  revalidatePath('/elections');
  return { ok: true };
}

export async function syncElectionLifecycleAction(id: string) {
  const session = await auth();
  if (!session?.accessToken) return { error: 'Not signed in.' };
  const res = await fetch(`${apiBase}/elections/${encodeURIComponent(id)}/sync-lifecycle`, {
    method: 'POST',
    headers: buildApiHeaders(session),
    cache: 'no-store',
  });
  if (!res.ok) return { error: `Sync failed (${res.status})` };
  revalidatePath('/elections');
  return { ok: true };
}

export async function fetchBallotAction(electionId: string) {
  const session = await auth();
  if (!session?.accessToken) return { error: 'Not signed in.' as const };
  const res = await fetch(`${apiBase}/elections/${encodeURIComponent(electionId)}/ballot`, {
    headers: buildApiHeaders(session),
    cache: 'no-store',
  });
  if (!res.ok) return { error: `Ballot unavailable (${res.status})` as const };
  return { data: (await res.json()) as unknown };
}

export async function issueBoothCredentialAction(electionId: string, ballotCommitment?: string) {
  const session = await auth();
  if (!session?.accessToken) return { error: 'Not signed in.' };
  const res = await fetch(`${apiBase}/elections/${encodeURIComponent(electionId)}/booth/issue`, {
    method: 'POST',
    headers: { ...buildApiHeaders(session), 'Content-Type': 'application/json' },
    body: JSON.stringify(ballotCommitment ? { ballotCommitment } : {}),
    cache: 'no-store',
  });
  if (!res.ok) return { error: `Booth issue failed (${res.status}): ${await res.text()}` };
  const body = (await res.json()) as {
    ballotToken: string;
    ballotSignature: string;
    electionId: string;
    rsaPublicParams?: { modulusHex: string; exponentHex: string };
  };
  return {
    ballotToken: body.ballotToken,
    ballotSignature: body.ballotSignature,
    electionId: body.electionId,
    rsaPublicParams: body.rsaPublicParams,
  };
}

export async function blindSignBoothAction(
  electionId: string,
  ballotToken: string,
  blindedCommitmentHex: string,
) {
  const session = await auth();
  if (!session?.accessToken) return { error: 'Not signed in.' };
  const res = await fetch(
    `${apiBase}/elections/${encodeURIComponent(electionId)}/booth/blind-sign`,
    {
      method: 'POST',
      headers: { ...buildApiHeaders(session), 'Content-Type': 'application/json' },
      body: JSON.stringify({ ballotToken, blindedCommitmentHex }),
      cache: 'no-store',
    },
  );
  if (!res.ok) return { error: `Blind sign failed (${res.status}): ${await res.text()}` };
  const body = (await res.json()) as { signedBlindedHex: string };
  return { signedBlindedHex: body.signedBlindedHex };
}

export async function castVoteAction(
  electionId: string,
  choices: Array<{ position: string; candidateId: string }>,
) {
  const session = await auth();
  if (!session?.accessToken) return { error: 'Not signed in.' };
  const res = await fetch(`${apiBase}/elections/${encodeURIComponent(electionId)}/vote`, {
    method: 'POST',
    headers: { ...buildApiHeaders(session), 'Content-Type': 'application/json' },
    body: JSON.stringify({ choices }),
    cache: 'no-store',
  });
  if (!res.ok) return { error: `Vote failed (${res.status}): ${await res.text()}` };
  const body = (await res.json()) as { verificationToken?: string };
  revalidatePath('/elections');
  return { verificationToken: body.verificationToken };
}

export async function fetchPublicResultsAction(electionId: string) {
  const session = await auth();
  if (!session?.accessToken) return { error: 'Not signed in.' as const };
  const res = await fetch(`${apiBase}/elections/${encodeURIComponent(electionId)}/public-results`, {
    headers: buildApiHeaders(session),
    cache: 'no-store',
  });
  if (!res.ok) return { error: `Results unavailable (${res.status})` as const };
  return { data: (await res.json()) as unknown };
}

export async function fetchAdminResultsAction(electionId: string) {
  const session = await auth();
  if (!session?.accessToken) return { error: 'Not signed in.' as const };
  const res = await fetch(`${apiBase}/elections/${encodeURIComponent(electionId)}/results`, {
    headers: buildApiHeaders(session),
    cache: 'no-store',
  });
  if (!res.ok) return { error: `Results unavailable (${res.status})` as const };
  return { data: (await res.json()) as unknown };
}

export async function startCertificationAction(id: string) {
  const session = await auth();
  if (!session?.accessToken) return { error: 'Not signed in.' };
  const res = await fetch(`${apiBase}/elections/${encodeURIComponent(id)}/start-certification`, {
    method: 'POST',
    headers: buildApiHeaders(session),
    cache: 'no-store',
  });
  if (!res.ok) return { error: `Certification failed (${res.status})` };
  revalidatePath('/elections');
  return { ok: true };
}

export async function publishElectionResultsAction(id: string) {
  const session = await auth();
  if (!session?.accessToken) return { error: 'Not signed in.' };
  const res = await fetch(`${apiBase}/elections/${encodeURIComponent(id)}/publish-results`, {
    method: 'POST',
    headers: buildApiHeaders(session),
    cache: 'no-store',
  });
  if (!res.ok) return { error: `Publish failed (${res.status})` };
  revalidatePath('/elections');
  return { ok: true };
}

export async function fetchElectionAuditAction(electionId: string) {
  const session = await auth();
  if (!session?.accessToken) return { error: 'Not signed in.' as const };
  const res = await fetch(`${apiBase}/elections/${encodeURIComponent(electionId)}/audit`, {
    headers: buildApiHeaders(session),
    cache: 'no-store',
  });
  if (!res.ok) return { error: `Audit unavailable (${res.status})` as const };
  return { data: ((await res.json()) as { data?: unknown[] }).data ?? [] };
}
