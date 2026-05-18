import { ElectionStatus, type Election } from '@prisma/client';

/** Derive the phase-appropriate status from calendar dates (non-terminal states only). */
export function deriveElectionStatusFromDates(
  election: Pick<
    Election,
    'status' | 'nominationOpenDate' | 'nominationCloseDate' | 'votingOpenDate' | 'votingCloseDate'
  >,
  now = new Date(),
): ElectionStatus | null {
  const t = now.getTime();
  const terminal = new Set<ElectionStatus>([
    ElectionStatus.CERTIFICATION_PENDING,
    ElectionStatus.PUBLISHED,
    ElectionStatus.ARCHIVED,
  ]);
  if (terminal.has(election.status)) return null;

  if (t < election.nominationOpenDate.getTime()) {
    return ElectionStatus.DRAFT;
  }
  if (t <= election.nominationCloseDate.getTime()) {
    return ElectionStatus.NOMINATIONS_OPEN;
  }
  if (t < election.votingOpenDate.getTime()) {
    return ElectionStatus.NOMINATIONS_CLOSED;
  }
  if (t <= election.votingCloseDate.getTime()) {
    return ElectionStatus.VOTING_OPEN;
  }
  if (
    election.status === ElectionStatus.VOTING_OPEN ||
    election.status === ElectionStatus.NOMINATIONS_CLOSED ||
    election.status === ElectionStatus.VOTING_CLOSED
  ) {
    return ElectionStatus.VOTING_CLOSED;
  }
  return null;
}

export function isNominationPhase(
  election: Pick<Election, 'status' | 'nominationOpenDate' | 'nominationCloseDate'>,
) {
  const now = Date.now();
  return (
    election.status === ElectionStatus.NOMINATIONS_OPEN &&
    now >= election.nominationOpenDate.getTime() &&
    now <= election.nominationCloseDate.getTime()
  );
}

export function isVotingPhase(
  election: Pick<Election, 'status' | 'votingOpenDate' | 'votingCloseDate'>,
) {
  const now = Date.now();
  return (
    election.status === ElectionStatus.VOTING_OPEN &&
    now >= election.votingOpenDate.getTime() &&
    now <= election.votingCloseDate.getTime()
  );
}
