import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import { BILLING_LOCK_INVOICE_QUEUE } from '../../queues/queue.constants';
import { BillingInvoiceService } from '../billing-invoice.service';
import type { LockInvoiceJobData } from './billing-jobs.service';

@Processor(BILLING_LOCK_INVOICE_QUEUE)
export class LockInvoiceProcessor extends WorkerHost {
  private readonly log = new Logger(LockInvoiceProcessor.name);

  constructor(private readonly invoices: BillingInvoiceService) {
    super();
  }

  async process(job: Job<LockInvoiceJobData>): Promise<void> {
    const result = await this.invoices.lockInvoiceAfterDisputeWindow(
      job.data.institutionId,
      job.data.invoiceId,
    );
    this.log.log(`Lock invoice job ${job.id}: ${result.status} invoice=${job.data.invoiceId}`);
  }
}
