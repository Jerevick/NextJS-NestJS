import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import { BILLING_RETROACTIVE_QUEUE } from '../../queues/queue.constants';
import { BillingInvoiceService } from '../billing-invoice.service';
import type { RetroactiveBillingJobData } from './billing-jobs.service';

@Processor(BILLING_RETROACTIVE_QUEUE)
export class RetroactiveBillingProcessor extends WorkerHost {
  private readonly log = new Logger(RetroactiveBillingProcessor.name);

  constructor(private readonly invoices: BillingInvoiceService) {
    super();
  }

  async process(job: Job<RetroactiveBillingJobData>): Promise<void> {
    const d = job.data;
    const result = await this.invoices.generateRetroactiveInvoiceForBackfill({
      institutionId: d.institutionId,
      entityId: d.entityId,
      backfillRequestId: d.backfillRequestId,
      studentId: d.studentId,
      studentNumber: d.studentNumber,
      fromDate: new Date(d.fromDateIso),
      toDate: new Date(d.toDateIso),
    });
    this.log.log(
      `Retroactive billing ${job.id}: invoice=${result.invoiceId} amount=${result.amount} skipped=${result.skipped}`,
    );
  }
}
