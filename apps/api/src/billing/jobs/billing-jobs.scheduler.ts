import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { BillingJobsService } from './billing-jobs.service';

@Injectable()
export class BillingJobsScheduler {
  private readonly log = new Logger(BillingJobsScheduler.name);

  constructor(
    private readonly jobs: BillingJobsService,
    private readonly prisma: PrismaService,
  ) {}

  @Cron('0 2 * * *', { timeZone: 'UTC' })
  async enqueueDailySnapshots(): Promise<void> {
    try {
      await this.jobs.runDailySnapshots(new Date());
    } catch (err) {
      this.log.error(err instanceof Error ? err.message : 'Daily snapshot enqueue failed');
    }
  }

  /** 07:05 UTC on the 1st — previous month rollup for all institutions. */
  @Cron('5 7 1 * *', { timeZone: 'UTC' })
  async enqueueMonthlyRollup(): Promise<void> {
    try {
      const now = new Date();
      const prev = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
      await this.jobs.runMonthlyRollup(prev.getUTCFullYear(), prev.getUTCMonth() + 1);
    } catch (err) {
      this.log.error(err instanceof Error ? err.message : 'Monthly rollup enqueue failed');
    }
  }

  /** 08:00 UTC daily — enqueue per-institution monthly jobs on each institution's billing day. */
  @Cron('0 8 * * *', { timeZone: 'UTC' })
  async enqueueInstitutionBillingDayJobs(): Promise<void> {
    const today = new Date();
    const dom = today.getUTCDate();
    const institutions = await this.prisma.institution.findMany({
      where: { deletedAt: null, status: 'ACTIVE', billingDayOfMonth: dom },
      select: { id: true },
    });
    if (institutions.length === 0) {
      return;
    }
    const prev = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 1, 1));
    const year = prev.getUTCFullYear();
    const month = prev.getUTCMonth() + 1;
    for (const inst of institutions) {
      try {
        await this.jobs.runMonthlyRollup(year, month, inst.id);
      } catch (err) {
        this.log.error(
          `Monthly rollup failed for institution ${inst.id}: ${err instanceof Error ? err.message : err}`,
        );
      }
    }
  }
}
