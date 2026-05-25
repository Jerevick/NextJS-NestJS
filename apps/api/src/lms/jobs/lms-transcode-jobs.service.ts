import { Injectable, Logger, Optional } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import { LMS_TRANSCODE_QUEUE } from '../../queues/queue.constants';
import { LmsTranscodeService } from '../lms-transcode.service';

export type LmsTranscodeJobData = {
  institutionId: string;
  lessonId: string;
  resourceId: string;
  sourceFileKey: string;
};

@Injectable()
export class LmsTranscodeJobsService {
  private readonly log = new Logger(LmsTranscodeJobsService.name);

  constructor(
    private readonly transcode: LmsTranscodeService,
    @Optional() @InjectQueue(LMS_TRANSCODE_QUEUE) private readonly queue?: Queue,
  ) {}

  async enqueue(data: LmsTranscodeJobData): Promise<void> {
    if (this.queue) {
      await this.queue.add('transcode', data, {
        jobId: `lms-transcode-${data.lessonId}-${data.resourceId}`,
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: 50,
        removeOnFail: 50,
      });
      return;
    }
    this.log.warn('REDIS_URL unset — running LMS transcode inline');
    await this.transcode.run(data);
  }
}
