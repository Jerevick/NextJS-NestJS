import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { InstitutionHealthService } from './institution-health.service';

/** Daily institution health recompute (WP-6.1). */
@Injectable()
export class InstitutionHealthScheduler {
  private readonly log = new Logger(InstitutionHealthScheduler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly health: InstitutionHealthService,
  ) {}

  @Cron('30 3 * * *', { timeZone: 'UTC' })
  async recomputeAll(): Promise<void> {
    const institutions = await this.prisma.institution.findMany({
      where: { deletedAt: null },
      select: { id: true },
    });
    for (const inst of institutions) {
      const breakdown = await this.health.compute(inst.id);
      const row = await this.prisma.institution.findFirst({
        where: { id: inst.id },
        select: { settings: true },
      });
      const base =
        row?.settings && typeof row.settings === 'object' && !Array.isArray(row.settings)
          ? (row.settings as Record<string, unknown>)
          : {};
      await this.prisma.institution.update({
        where: { id: inst.id },
        data: {
          settings: {
            ...base,
            healthCache: { ...breakdown, computedAt: new Date().toISOString() },
          },
        },
      });
    }
    this.log.log(`Health cache refreshed for ${institutions.length} institutions`);
  }
}
