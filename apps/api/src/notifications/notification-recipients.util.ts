import type { PrismaService } from '../prisma/prisma.service';

export type GuardianContact = {
  userId?: string;
  email?: string;
  name?: string;
};

/** Parse `Student.guardians` JSON into contacts. */
export function parseGuardianContacts(guardians: unknown): GuardianContact[] {
  if (!Array.isArray(guardians)) {
    return [];
  }
  const out: GuardianContact[] = [];
  for (const entry of guardians) {
    if (typeof entry === 'string' && entry.trim()) {
      out.push({ userId: entry.trim() });
      continue;
    }
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      continue;
    }
    const o = entry as Record<string, unknown>;
    const userId =
      typeof o.userId === 'string' ? o.userId : typeof o.id === 'string' ? o.id : undefined;
    const email = typeof o.email === 'string' ? o.email : undefined;
    const name = typeof o.name === 'string' ? o.name : undefined;
    if (userId || email) {
      out.push({ userId, email, name });
    }
  }
  return out;
}

export async function findPositionHolderUserIds(
  prisma: PrismaService,
  institutionId: string,
  entityId: string,
  positionCodes: string[],
): Promise<string[]> {
  const positions = await prisma.position.findMany({
    where: {
      institutionId,
      entityId,
      code: { in: positionCodes },
      deletedAt: null,
    },
    select: { id: true },
  });
  if (!positions.length) {
    return [];
  }
  const holders = await prisma.positionHolder.findMany({
    where: {
      positionId: { in: positions.map((p) => p.id) },
      endDate: null,
    },
    select: { userId: true },
  });
  return [...new Set(holders.map((h) => h.userId))];
}

export async function findInstitutionFinanceNotifiers(
  prisma: PrismaService,
  institutionId: string,
  entityId: string,
): Promise<string[]> {
  const byPosition = await findPositionHolderUserIds(prisma, institutionId, entityId, [
    'REG',
    'BURSAR',
  ]);
  if (byPosition.length) {
    return byPosition;
  }
  const rolePerms = await prisma.rolePermission.findMany({
    where: {
      role: { institutionId },
      permission: { code: { in: ['finance.write', 'finance.read', 'billing.read'] } },
    },
    select: {
      role: {
        select: {
          assignments: {
            select: { userId: true },
          },
        },
      },
    },
    take: 50,
  });
  const ids = new Set<string>();
  for (const rp of rolePerms) {
    for (const a of rp.role.assignments) {
      ids.add(a.userId);
    }
  }
  return [...ids].slice(0, 20);
}
