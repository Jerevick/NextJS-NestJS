import { DynamicModule, Logger, Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import {
  BILLING_DAILY_SNAPSHOT_QUEUE,
  BILLING_LOCK_INVOICE_QUEUE,
  BILLING_MONTHLY_QUEUE,
  BILLING_RETROACTIVE_QUEUE,
} from '../queues/queue.constants';
import { BillingCoreModule } from './billing-core.module';
import { BillingJobsScheduler } from './jobs/billing-jobs.scheduler';
import { DailySnapshotProcessor } from './jobs/daily-snapshot.processor';
import { LockInvoiceProcessor } from './jobs/lock-invoice.processor';
import { MonthlyBillingProcessor } from './jobs/monthly-billing.processor';
import { RetroactiveBillingProcessor } from './jobs/retroactive-billing.processor';

const log = new Logger('BillingModule');

@Module({})
export class BillingModule {
  static register(): DynamicModule {
    const useBull = Boolean(process.env.REDIS_URL?.trim());
    if (!useBull) {
      log.warn(
        'REDIS_URL is not set — billing cron runs synchronously in-process (no BullMQ workers).',
      );
    }

    const bullQueues = useBull
      ? [
          BullModule.registerQueue({ name: BILLING_DAILY_SNAPSHOT_QUEUE }),
          BullModule.registerQueue({ name: BILLING_MONTHLY_QUEUE }),
          BullModule.registerQueue({ name: BILLING_LOCK_INVOICE_QUEUE }),
          BullModule.registerQueue({ name: BILLING_RETROACTIVE_QUEUE }),
        ]
      : [];

    const processors = useBull
      ? [
          DailySnapshotProcessor,
          MonthlyBillingProcessor,
          LockInvoiceProcessor,
          RetroactiveBillingProcessor,
        ]
      : [];

    return {
      module: BillingModule,
      imports: [BillingCoreModule, ...bullQueues],
      providers: [BillingJobsScheduler, ...processors],
      exports: [BillingCoreModule],
    };
  }
}
