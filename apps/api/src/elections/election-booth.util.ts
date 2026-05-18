import { createHmac, randomBytes, timingSafeEqual } from 'crypto';
import { institutionVotingSecret } from './election-vote.util';

/** Opaque one-time booth token (stored on ElectionVoter; not linked on vote rows). */
export function newBallotToken(): string {
  return randomBytes(32).toString('hex');
}

/**
 * Blind booth credential: HMAC proves the bearer was issued a ballot without revealing userId on the vote.
 * voterHash on ElectionVote remains the anonymity layer for tallying.
 */
export function signBallotCredential(
  institutionId: string,
  electionId: string,
  ballotToken: string,
): string {
  const secret = institutionVotingSecret(institutionId);
  return createHmac('sha256', secret).update(`booth:${electionId}:${ballotToken}`).digest('hex');
}

export function verifyBallotCredential(
  institutionId: string,
  electionId: string,
  ballotToken: string,
  signature: string,
): boolean {
  const expected = signBallotCredential(institutionId, electionId, ballotToken);
  try {
    const a = Buffer.from(expected, 'hex');
    const b = Buffer.from(signature, 'hex');
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
