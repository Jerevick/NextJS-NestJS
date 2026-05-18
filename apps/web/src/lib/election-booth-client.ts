'use client';

import {
  blindCommitment,
  buildBallotCommitmentBrowser,
  randomNonceHex,
  unblindSignature,
  type RsaPublicParams,
} from '@unicore/utils/election-blind-rsa-browser';

export type BoothRsaParams = RsaPublicParams;

export async function clientBlindEndorse(args: {
  electionId: string;
  ballotCommitment: string;
  rsaPublicParams: BoothRsaParams;
  signBlinded: (blindedCommitmentHex: string) => Promise<{ signedBlindedHex: string }>;
}): Promise<{ blindRsaSignature: string; blindingFactorHex: string }> {
  const { blindedHex, blindingFactorHex } = blindCommitment(
    args.ballotCommitment,
    args.rsaPublicParams,
  );
  const { signedBlindedHex } = await args.signBlinded(blindedHex);
  const blindRsaSignature = unblindSignature(
    signedBlindedHex,
    blindingFactorHex,
    args.rsaPublicParams,
  );
  return { blindRsaSignature, blindingFactorHex };
}

export async function generateClientBallotCommitment(electionId: string): Promise<{
  nonceHex: string;
  ballotCommitment: string;
}> {
  const nonceHex = randomNonceHex();
  const ballotCommitment = await buildBallotCommitmentBrowser(electionId, nonceHex);
  return { nonceHex, ballotCommitment };
}
