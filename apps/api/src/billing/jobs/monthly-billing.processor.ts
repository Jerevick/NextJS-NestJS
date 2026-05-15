import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import { BILLING_MONTHLY_QUEUE } from '../../queues/queue.constants';
import { BillingSnapshotService } from '../billing-snapshot.service';
import type { MonthlyBillingJobData } from './billing-jobs.service';

@Processor(BILLING_MONTHLY_QUEUE)
export class MonthlyBillingProcessor extends WorkerHost {
  private readonly log = new Logger(MonthlyBillingProcessor.name);

  constructor(private readonly snapshots: BillingSnapshotService) {
    super();
  }

  async process(job: Job<MonthlyBillingJobData>): Promise<void> {
    const { year, month, institutionId } = job.data;
    if (institutionId) {
      const r = await this.snapshots.runMonthlyRollupForInstitution(institutionId, year, month);
      this.log.log(`Monthly rollup ${job.id}: institution=${institutionId} entities=${r.entitiesProcessed}`);
      return;
    }
    const r = await this.snapshots.runAllInstitutionsForCalendarMonth(year, month);
    this.log.log(
      `Monthly rollup ${job.id}: year=${year} month=${month} institutions=${r.institutionsUpdated}`,
    );
  }
}
