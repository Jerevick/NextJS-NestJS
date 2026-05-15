import { Module } from '@nestjs/common';
import { BillingCoreModule } from '../billing/billing-core.module';
import { WorkflowEngineModule } from '../workflow-engine/workflow-engine.module';
import { BackfillRequestsController } from './backfill-requests.controller';
import { BackfillRequestService } from './backfill-request.service';
import { PermissionsGuard } from '../common/guards/permissions.guard';

@Module({
  imports: [WorkflowEngineModule, BillingCoreModule],
  controllers: [BackfillRequestsController],
  providers: [BackfillRequestService, PermissionsGuard],
})
export class BackfillModule {}
