import { NotFoundException } from '@nestjs/common';
import { OrgChartService } from './org-chart.service';

describe('OrgChartService', () => {
  const prisma = {
    institutionEntity: { findFirst: jest.fn() },
  };
  const repo = { orgUnitsWithHolders: jest.fn() };
  let service: OrgChartService;

  const user = {
    institutionId: 'inst-1',
    entityId: 'ent-1',
    entityScope: 'ENTITY' as const,
    permissions: ['staff.read'],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new OrgChartService(repo as never, prisma as never);
  });

  it('returns nested tree with staff photos and position holders', async () => {
    prisma.institutionEntity.findFirst.mockResolvedValue({
      id: 'ent-1',
      code: 'MAIN',
      name: 'Main Campus',
    });
    repo.orgUnitsWithHolders.mockResolvedValue([
      {
        id: 'ou-1',
        name: 'Faculty of Science',
        code: 'FOS',
        type: 'FACULTY',
        parentId: null,
        staffProfiles: [
          {
            id: 'sp-1',
            staffNumber: 'STF001',
            user: {
              email: 'a@test.com',
              profile: { displayName: 'Alice', photoUrl: 'https://x/a.jpg' },
            },
            position: { id: 'pos-1', title: 'Lecturer', code: 'LEC' },
          },
        ],
        positions: [
          {
            id: 'pos-dean',
            title: 'Dean',
            code: 'DEAN',
            holders: [
              {
                userId: 'u-2',
                isActing: false,
                user: {
                  email: 'dean@test.com',
                  profile: { firstName: 'Bob', lastName: 'Dean' },
                  staffProfiles: [
                    {
                      id: 'sp-2',
                      staffNumber: 'STF002',
                      user: { profile: { avatarUrl: 'https://x/b.jpg' } },
                    },
                  ],
                },
              },
            ],
          },
        ],
      },
    ]);

    const result = await service.orgChart(user as never, 'ent-1');

    expect(result.entity.code).toBe('MAIN');
    expect(result.tree).toHaveLength(1);
    expect(result.tree[0].staff[0]).toMatchObject({
      staffNumber: 'STF001',
      photoUrl: 'https://x/a.jpg',
    });
    expect(result.tree[0].positions[0].holders[0]).toMatchObject({
      name: 'Bob Dean',
      staffNumber: 'STF002',
      photoUrl: 'https://x/b.jpg',
    });
  });

  it('rejects entity outside actor scope', async () => {
    await expect(
      service.orgChart({ ...user, entityId: 'ent-1', entityScope: 'ENTITY' } as never, 'ent-2'),
    ).rejects.toThrow('outside your entity scope');
  });

  it('throws when entity does not exist', async () => {
    prisma.institutionEntity.findFirst.mockResolvedValue(null);
    await expect(service.orgChart(user as never, 'ent-1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
