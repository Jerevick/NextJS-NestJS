import { createHash, randomBytes } from 'crypto';

/** Institution-scoped secret for blind voter hashing (never stored per-vote with userId). */
export function institutionVotingSecret(institutionId: string): string {
  const base =
    process.env.ELECTION_VOTING_SECRET ?? process.env.JWT_SECRET ?? 'unicore-election-dev';
  return createHash('sha256').update(`${base}:${institutionId}`).digest('hex');
}

/** SHA-256(electionId + userId + institutionSecret) — stored instead of userId on votes. */
export function computeVoterHash(
  electionId: string,
  userId: string,
  institutionId: string,
): string {
  const secret = institutionVotingSecret(institutionId);
  return createHash('sha256').update(`${electionId}:${userId}:${secret}`).digest('hex');
}

export function newVerificationToken(): string {
  return randomBytes(32).toString('hex');
}
