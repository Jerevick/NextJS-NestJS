import { ElectionStatus } from '@prisma/client';
import { deriveElectionStatusFromDates, isVotingPhase } from './election-lifecycle.util';

describe('election-lifecycle.util', () => {
  const base = {
    status: ElectionStatus.DRAFT,
    nominationOpenDate: new Date('2026-06-01T00:00:00Z'),
    nominationCloseDate: new Date('2026-06-07T23:59:59Z'),
    votingOpenDate: new Date('2026-06-08T00:00:00Z'),
    votingCloseDate: new Date('2026-06-14T23:59:59Z'),
  };

  it('opens nominations when inside nomination window', () => {
    expect(deriveElectionStatusFromDates(base, new Date('2026-06-03T12:00:00Z'))).toBe(
      ElectionStatus.NOMINATIONS_OPEN,
    );
  });

  it('opens voting when inside voting window', () => {
    expect(
      deriveElectionStatusFromDates(
        { ...base, status: ElectionStatus.NOMINATIONS_CLOSED },
        new Date('2026-06-10T12:00:00Z'),
      ),
    ).toBe(ElectionStatus.VOTING_OPEN);
  });

  it('detects active voting phase', () => {
    expect(
      isVotingPhase({
        status: ElectionStatus.VOTING_OPEN,
        votingOpenDate: base.votingOpenDate,
        votingCloseDate: base.votingCloseDate,
      }),
    ).toBe(true);
  });
});
