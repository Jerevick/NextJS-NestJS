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
    const users = await this.prisma.user.findMany({
      where: {
        deletedAt: null,
        lastLoginAt: { gte: since },
        institution: { deletedAt: null },
      },
      select: {
        institutionId: true,
        institution: { select: { name: true } },
      },
    });

    const counts = new Map<string, { name: string; online: number }>();
    for (const user of users) {
      const current = counts.get(user.institutionId);
      if (current) {
        current.online += 1;
      } else {
        counts.set(user.institutionId, {
          name: user.institution.name,
          online: 1,
        });
      }
    }

    const byInstitution = Array.from(counts.entries())
      .map(([institutionId, row]) => ({
        institutionId,
        name: row.name,
        online: row.online,
      }))
      .sort((a, b) => b.online - a.online);

    return {
      totalOnline: byInstitution.reduce((s, r) => s + r.online, 0),
      byInstitution,
      asOf: new Date().toISOString(),
    };
  }
}
