import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { BulkEnrollmentJobStatus } from '@prisma/client';
import type { Job } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { BULK_ENROLLMENT_QUEUE } from '../queues/queue.constants';
import type { BulkEnrollmentJobData } from './bulk-enrollment.service';
import { BulkEnrollmentService } from './bulk-enrollment.service';

@Processor(BULK_ENROLLMENT_QUEUE)
export class BulkEnrollmentProcessor extends WorkerHost {
  private readonly log = new Logger(BulkEnrollmentProcessor.name);

  constructor(
    private readonly bulk: BulkEnrollmentService,
    private readonly prisma: PrismaService,
  ) {
    super();
  }

  async process(job: Job<BulkEnrollmentJobData>): Promise<void> {
    try {
      await this.bulk.runJob(job.data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Bulk enrollment failed';
      this.log.error(`bulk-enrollment job ${job.data.jobId}: ${message}`);
      await this.prisma.bulkEnrollmentJob.update({
        where: { id: job.data.jobId },
        data: {
          status: BulkEnrollmentJobStatus.FAILED,
          errorMessage: message,
          completedAt: new Date(),
        },
      });
      throw err;
    }
  }
}
