import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import { SPORTS_ELIGIBILITY_QUEUE } from '../../queues/queue.constants';
import {
  SportsEligibilityJobsService,
  type SportsEligibilityJobData,
} from './sports-eligibility-jobs.service';

@Processor(SPORTS_ELIGIBILITY_QUEUE)
export class SportsEligibilityProcessor extends WorkerHost {
  private readonly log = new Logger(SportsEligibilityProcessor.name);

  constructor(private readonly jobs: SportsEligibilityJobsService) {
    super();
  }

  async process(job: Job<SportsEligibilityJobData>): Promise<void> {
    await this.jobs.processJob(job.data);
    this.log.log(`Sports eligibility job ${job.name} completed`);
  }
}
