import {
  computeVoterHash,
  institutionVotingSecret,
  newVerificationToken,
} from './election-vote.util';

describe('election-vote.util', () => {
  it('produces stable voter hashes per election and user', () => {
    const a = computeVoterHash('el-1', 'user-1', 'inst-1');
    const b = computeVoterHash('el-1', 'user-1', 'inst-1');
    const c = computeVoterHash('el-1', 'user-2', 'inst-1');
    expect(a).toBe(b);
    expect(a).not.toBe(c);
    expect(a).toHaveLength(64);
  });

  it('scopes institution secret per tenant', () => {
    expect(institutionVotingSecret('a')).not.toBe(institutionVotingSecret('b'));
  });

  it('issues unique verification tokens', () => {
    expect(newVerificationToken()).not.toBe(newVerificationToken());
  });
});
