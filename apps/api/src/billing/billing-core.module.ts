import { Module } from '@nestjs/common';
import { AnyPermissionsGuard } from '../common/guards/any-permissions.guard';
import { StorageModule } from '../storage/storage.module';
import { BillingController } from './billing.controller';
import { BillingDisputeService } from './billing-dispute.service';
import { BillingEvidenceService } from './billing-evidence.service';
import { BillingRepository } from './billing.repository';
import { BillingService } from './billing.service';
import { BillingInvoiceService } from './billing-invoice.service';
import { BillingSnapshotService } from './billing-snapshot.service';
import { StripeWebhookController } from './stripe-webhook.controller';
import { BillingJobsService } from './jobs/billing-jobs.service';

@Module({
  imports: [StorageModule],
  controllers: [BillingController, StripeWebhookController],
  providers: [
    BillingService,
    BillingDisputeService,
    BillingRepository,
    BillingSnapshotService,
    BillingInvoiceService,
    BillingEvidenceService,
    BillingJobsService,
    AnyPermissionsGuard,
  ],
  exports: [
    BillingInvoiceService,
    BillingSnapshotService,
    BillingJobsService,
    BillingEvidenceService,
    BillingService,
  ],
})
export class BillingCoreModule {}
