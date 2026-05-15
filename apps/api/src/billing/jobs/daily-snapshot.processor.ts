import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import { BILLING_DAILY_SNAPSHOT_QUEUE } from '../../queues/queue.constants';
import { BillingSnapshotService } from '../billing-snapshot.service';
import type { DailySnapshotJobData } from './billing-jobs.service';

@Processor(BILLING_DAILY_SNAPSHOT_QUEUE)
export class DailySnapshotProcessor extends WorkerHost {
  private readonly log = new Logger(DailySnapshotProcessor.name);

  constructor(private readonly snapshots: BillingSnapshotService) {
    super();
  }

  async process(job: Job<DailySnapshotJobData>): Promise<void> {
    const day = new Date(job.data.dayIso);
    const summary = await this.snapshots.runAllInstitutionsForUtcDay(day);
    this.log.log(
      `Daily snapshot job ${job.id}: entities=${summary.processedEntities} institutions=${summary.institutionsUpdated}`,
    );
  }
}
