/** Browser-only helpers (Web Crypto SHA-256 for commitments). */

import {
  blindCommitment,
  unblindSignature,
  verifyBlindRsaSignature,
  type RsaPublicParams,
} from './election-blind-rsa.js';

export type { RsaPublicParams };
export { blindCommitment, unblindSignature, verifyBlindRsaSignature };

export async function buildBallotCommitmentBrowser(
  electionId: string,
  nonceHex: string,
): Promise<string> {
  const data = new TextEncoder().encode(`ballot:${electionId}:${nonceHex}`);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function randomNonceHex(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
