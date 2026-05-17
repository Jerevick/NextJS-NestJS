import { ResitGradeService } from './resit-grade.service';

describe('ResitGradeService', () => {
  const prisma = {
    resitRecord: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
  };

  let service: ResitGradeService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ResitGradeService(prisma as never);
  });

  it('returns the raw score when no resit is registered', async () => {
    prisma.resitRecord.findFirst.mockResolvedValue(null);
    const out = await service.clampNumericScoreForEnrollment('i1', 'e1', 88);
    expect(out).toEqual({ score: 88, capApplied: false });
    expect(prisma.resitRecord.update).not.toHaveBeenCalled();
  });

  it('clamps to the cap percent and sets capApplied when the score exceeds the cap', async () => {
    prisma.resitRecord.findFirst.mockResolvedValue({
      id: 'r1',
      gradeCapPercent: { toNumber: () => 50 },
    });
    const out = await service.clampNumericScoreForEnrollment('i1', 'e1', 88);
    expect(out).toEqual({ score: 50, capApplied: true });
    expect(prisma.resitRecord.update).toHaveBeenCalledWith({
      where: { id: 'r1' },
      data: { capApplied: true },
    });
  });

  it('does not update capApplied when the score is already at or below the cap', async () => {
    prisma.resitRecord.findFirst.mockResolvedValue({
      id: 'r1',
      gradeCapPercent: { toNumber: () => 50 },
    });
    const out = await service.clampNumericScoreForEnrollment('i1', 'e1', 48);
    expect(out).toEqual({ score: 48, capApplied: false });
    expect(prisma.resitRecord.update).not.toHaveBeenCalled();
  });
});
