import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import { LMS_TRANSCODE_QUEUE } from '../../queues/queue.constants';
import { LmsTranscodeService } from '../lms-transcode.service';
import type { LmsTranscodeJobData } from './lms-transcode-jobs.service';

@Processor(LMS_TRANSCODE_QUEUE)
export class LmsTranscodeProcessor extends WorkerHost {
  private readonly log = new Logger(LmsTranscodeProcessor.name);

  constructor(private readonly transcode: LmsTranscodeService) {
    super();
  }

  async process(job: Job<LmsTranscodeJobData>): Promise<void> {
    this.log.log(`Processing transcode ${job.id}`);
    await this.transcode.run(job.data);
  }
}
