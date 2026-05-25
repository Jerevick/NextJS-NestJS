import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export type PlatformSessionSnapshot = {
  totalOnline: number;
  byInstitution: { institutionId: string; name: string; online: number }[];
  asOf: string;
};

@Injectable()
export class PlatformSessionMetricsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Users with login activity in the last 15 minutes (proxy for active sessions). */
  async snapshot(): Promise<PlatformSessionSnapshot> {
    const since = new Date(Date.now() - 15 * 60_000);
    const rows = await this.prisma.user.groupBy({
      by: ['institutionId'],
      where: { deletedAt: null, lastLoginAt: { gte: since } },
      _count: { _all: true },
    });
    const institutionIds = rows.map((r) => r.institutionId);
    const names = await this.prisma.institution.findMany({
      where: { id: { in: institutionIds }, deletedAt: null },
      select: { id: true, name: true },
    });
    const nameById = new Map(names.map((n) => [n.id, n.name]));
    const byInstitution = rows
      .map((r) => ({
        institutionId: r.institutionId,
        name: nameById.get(r.institutionId) ?? r.institutionId,
        online: r._count._all,
      }))
      .sort((a, b) => b.online - a.online);
    return {
      totalOnline: byInstitution.reduce((s, r) => s + r.online, 0),
      byInstitution,
      asOf: new Date().toISOString(),
    };
  }
}
