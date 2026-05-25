import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import {
  BILLING_DAILY_SNAPSHOT_QUEUE,
  BILLING_LOCK_INVOICE_QUEUE,
  BILLING_MONTHLY_QUEUE,
  BILLING_RETROACTIVE_QUEUE,
} from '../../queues/queue.constants';
import { BillingSnapshotService } from '../billing-snapshot.service';

export type DailySnapshotJobData = { dayIso: string };
export type MonthlyBillingJobData = { year: number; month: number; institutionId?: string };
export type LockInvoiceJobData = { invoiceId: string; institutionId: string };
export type RetroactiveBillingJobData = {
  institutionId: string;
  entityId: string;
  backfillRequestId: string;
  studentId: string;
  studentNumber: string;
  fromDateIso: string;
  toDateIso: string;
};

function utcDayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

@Injectable()
export class BillingJobsService {
  private readonly log = new Logger(BillingJobsService.name);

  constructor(
    private readonly snapshots: BillingSnapshotService,
    @Optional() @InjectQueue(BILLING_DAILY_SNAPSHOT_QUEUE) private readonly dailyQueue?: Queue,
    @Optional() @InjectQueue(BILLING_MONTHLY_QUEUE) private readonly monthlyQueue?: Queue,
    @Optional() @InjectQueue(BILLING_LOCK_INVOICE_QUEUE) private readonly lockQueue?: Queue,
    @Optional() @InjectQueue(BILLING_RETROACTIVE_QUEUE) private readonly retroQueue?: Queue,
  ) {}

  usesQueue(): boolean {
    return Boolean(this.dailyQueue);
  }

  async runDailySnapshots(day: Date = new Date()): Promise<void> {
    if (this.dailyQueue) {
      await this.dailyQueue.add(
        'run-all',
        { dayIso: day.toISOString() },
        {
          jobId: `daily-all-${utcDayKey(day)}`,
          attempts: 3,
          backoff: { type: 'exponential', delay: 5000 },
          removeOnComplete: false,
          removeOnFail: false,
        },
      );
      return;
    }
    await this.snapshots.runAllInstitutionsForUtcDay(day);
  }

  async runMonthlyRollup(year: number, month: number, institutionId?: string): Promise<void> {
    if (this.monthlyQueue) {
      const jobId = institutionId
        ? `monthly-${institutionId}-${year}-${month}`
        : `monthly-all-${year}-${month}`;
      await this.monthlyQueue.add(
        'rollup',
        { year, month, institutionId },
        {
          jobId,
          attempts: 3,
          backoff: { type: 'exponential', delay: 5000 },
          removeOnComplete: false,
          removeOnFail: false,
        },
      );
      return;
    }
    if (institutionId) {
      await this.snapshots.runMonthlyRollupForInstitution(institutionId, year, month);
    } else {
      await this.snapshots.runAllInstitutionsForCalendarMonth(year, month);
    }
  }

  async scheduleLockInvoice(
    invoiceId: string,
    institutionId: string,
    delayMs: number,
  ): Promise<void> {
    if (this.lockQueue) {
      await this.lockQueue.add(
        'lock',
        { invoiceId, institutionId },
        {
          jobId: `lock-invoice-${invoiceId}`,
          delay: delayMs,
          attempts: 3,
          backoff: { type: 'exponential', delay: 5000 },
          removeOnComplete: false,
          removeOnFail: false,
        },
      );
      return;
    }
    this.log.debug(
      `Lock invoice ${invoiceId} not scheduled (no Redis); finalize manually after dispute window`,
    );
  }

  async enqueueRetroactiveInvoice(data: RetroactiveBillingJobData): Promise<boolean> {
    if (!this.retroQueue) {
      return false;
    }
    await this.retroQueue.add('retroactive', data, {
      jobId: `retro-${data.backfillRequestId}`,
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
      removeOnComplete: false,
      removeOnFail: false,
    });
    return true;
  }
}
