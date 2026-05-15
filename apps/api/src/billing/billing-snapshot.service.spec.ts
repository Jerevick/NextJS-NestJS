import { BillingSnapshotService } from './billing-snapshot.service';

describe('BillingSnapshotService', () => {
  const prisma = {
    dailyBillableSnapshot: { findUnique: jest.fn(), create: jest.fn(), findMany: jest.fn() },
    student: { count: jest.fn() },
    monthlyBillableSummary: { upsert: jest.fn() },
    institution: { findMany: jest.fn(), update: jest.fn() },
    institutionEntity: { findMany: jest.fn() },
  };

  let service: BillingSnapshotService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new BillingSnapshotService(prisma as never);
  });

  it('utcStartOfDay normalizes to UTC midnight', () => {
    const d = new Date('2025-06-15T14:30:00.000Z');
    const start = service.utcStartOfDay(d);
    expect(start.toISOString()).toBe('2025-06-15T00:00:00.000Z');
  });

  it('computeMonthlyBillable uses max of peak and ceil average', async () => {
    prisma.dailyBillableSnapshot.findMany.mockResolvedValue([
      { billableCount: 100 },
      { billableCount: 120 },
      { billableCount: 110 },
    ]);
    prisma.monthlyBillableSummary.upsert.mockImplementation(({ create }: { create: { watermarkCount: number } }) =>
      Promise.resolve({
        institutionId: 'i1',
        entityId: 'e1',
        year: 2025,
        month: 5,
        peakDailyCount: 120,
        averageDailyCount: { toString: () => '110.0000' },
        watermarkCount: create.watermarkCount,
      }),
    );

    const result = await service.computeMonthlyBillable('i1', 'e1', 2025, 5);
    expect(result.peakDailyCount).toBe(120);
    expect(result.watermarkCount).toBe(120);
  });
});
