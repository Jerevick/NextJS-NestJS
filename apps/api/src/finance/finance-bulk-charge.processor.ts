import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { FinanceBulkChargeJobStatus } from '@prisma/client';
import type { Job } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { FINANCE_BULK_CHARGE_QUEUE } from '../queues/queue.constants';
import type { FinanceBulkChargeJobData } from './finance-bulk-charge.service';
import { FinanceBulkChargeService } from './finance-bulk-charge.service';

@Processor(FINANCE_BULK_CHARGE_QUEUE)
export class FinanceBulkChargeProcessor extends WorkerHost {
  private readonly log = new Logger(FinanceBulkChargeProcessor.name);

  constructor(
    private readonly bulk: FinanceBulkChargeService,
    private readonly prisma: PrismaService,
  ) {
    super();
  }

  async process(job: Job<FinanceBulkChargeJobData>): Promise<void> {
    try {
      await this.bulk.runJob(job.data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Bulk charge failed';
      this.log.error(`finance-bulk-charge ${job.data.jobId}: ${message}`);
      await this.prisma.financeBulkChargeJob.update({
        where: { id: job.data.jobId },
        data: {
          status: FinanceBulkChargeJobStatus.FAILED,
          errorMessage: message,
          completedAt: new Date(),
        },
      });
      throw err;
    }
  }
}
