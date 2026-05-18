import type { PrismaService } from '../prisma/prisma.service';
import { immediateHeadPositionCodes } from './appraisal-head.util';

type OrgUnitRow = { id: string; parentId: string | null };

/**
 * Resolves the immediate head (line manager) for a staff member by walking the org-unit
 * tree and matching supervising position codes (default: PC, LM, …), then HoD in chain.
 */
export async function resolveImmediateHeadUserId(
  prisma: PrismaService,
  input: {
    institutionId: string;
    entityId: string;
    orgUnitId: string;
    staffUserId: string;
    staffPositionLevel: number;
    hrSettings: Record<string, unknown>;
  },
): Promise<string | undefined> {
  const codes = immediateHeadPositionCodes(input.hrSettings);
  const hodFallback = input.hrSettings.appraisalHodFallback !== false;

  const units = await prisma.orgUnit.findMany({
    where: {
      institutionId: input.institutionId,
      entityId: input.entityId,
      deletedAt: null,
    },
    select: { id: true, parentId: true },
  });
  const byId = new Map(units.map((u) => [u.id, u]));

  const chain: OrgUnitRow[] = [];
  let cursor: OrgUnitRow | undefined = byId.get(input.orgUnitId);
  while (cursor) {
    chain.push(cursor);
    cursor = cursor.parentId ? byId.get(cursor.parentId) : undefined;
  }

  const activeHolder = async (positionId: string) => {
    const holder = await prisma.positionHolder.findFirst({
      where: {
        institutionId: input.institutionId,
        positionId,
        userId: { not: input.staffUserId },
        OR: [{ endDate: null }, { endDate: { gt: new Date() } }],
      },
      orderBy: { startDate: 'desc' },
      select: { userId: true },
    });
    return holder?.userId;
  };

  for (const unit of chain) {
    const supervisors = await prisma.position.findMany({
      where: {
        institutionId: input.institutionId,
        entityId: input.entityId,
        orgUnitId: unit.id,
        deletedAt: null,
        level: { lt: input.staffPositionLevel },
      },
      orderBy: [{ level: 'asc' }, { code: 'asc' }],
      select: { id: true, code: true },
    });

    for (const code of codes) {
      const pos = supervisors.find((p) => p.code === code);
      if (!pos) continue;
      const userId = await activeHolder(pos.id);
      if (userId) return userId;
    }

    if (hodFallback) {
      const hod = supervisors.find((p) => p.code === 'HOD');
      if (hod) {
        const userId = await activeHolder(hod.id);
        if (userId) return userId;
      }
    }
  }

  return undefined;
}
