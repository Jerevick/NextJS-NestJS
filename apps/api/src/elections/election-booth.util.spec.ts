import {
  newBallotToken,
  signBallotCredential,
  verifyBallotCredential,
} from './election-booth.util';

describe('election-booth.util', () => {
  const institutionId = 'inst-1';
  const electionId = 'el-1';

  it('issues verifiable blind booth credentials', () => {
    const token = newBallotToken();
    const sig = signBallotCredential(institutionId, electionId, token);
    expect(verifyBallotCredential(institutionId, electionId, token, sig)).toBe(true);
    expect(verifyBallotCredential(institutionId, electionId, token, 'bad')).toBe(false);
  });
});
