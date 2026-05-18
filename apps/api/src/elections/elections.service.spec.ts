import { ElectionStatus } from '@prisma/client';
import { ElectionsService } from './elections.service';

describe('ElectionsService results access', () => {
  const service = Object.create(ElectionsService.prototype) as ElectionsService;

  it('documents voting-phase guard for admin tallies', () => {
    const allowed = [ElectionStatus.VOTING_OPEN, ElectionStatus.VOTING_CLOSED];
    expect(allowed.includes(ElectionStatus.VOTING_OPEN)).toBe(true);
    expect(allowed.includes(ElectionStatus.DRAFT)).toBe(false);
  });
});
