import { blindCommitment, unblindSignature } from '@unicore/utils';
import {
  buildBallotCommitment,
  getElectionRsaKeys,
  newBallotCommitmentNonce,
  signBlindedCommitment,
  verifyWithStoredParams,
} from './election-blind-rsa.util';

describe('election-blind-rsa.util', () => {
  it('performs blind sign and verify round-trip', () => {
    const keys = getElectionRsaKeys();
    const commitment = buildBallotCommitment('el-1', newBallotCommitmentNonce());
    const { blindedHex, blindingFactorHex } = blindCommitment(commitment, keys.publicParams);
    const signedBlind = signBlindedCommitment(blindedHex);
    const signature = unblindSignature(signedBlind, blindingFactorHex, keys.publicParams);
    expect(verifyWithStoredParams(commitment, signature)).toBe(true);
  });
});
