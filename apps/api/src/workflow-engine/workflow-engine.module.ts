import { Module, forwardRef } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { BillingCoreModule } from '../billing/billing-core.module';
import { StudentsModule } from '../students/students.module';
import { WorkflowAssigneeResolver } from './workflow-assignee.resolver';
import { WorkflowCompletionHandler } from './workflow-completion.handler';
import { WorkflowEngineController } from './workflow-engine.controller';
import { WorkflowEngineService } from './workflow-engine.service';
import { WorkflowSlaScheduler } from './workflow-sla.scheduler';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { AnyPermissionsGuard } from '../common/guards/any-permissions.guard';

@Module({
  imports: [AuditModule, BillingCoreModule, forwardRef(() => StudentsModule)],
  controllers: [WorkflowEngineController],
  providers: [
    WorkflowEngineService,
    WorkflowAssigneeResolver,
    WorkflowCompletionHandler,
    WorkflowSlaScheduler,
    PermissionsGuard,
    AnyPermissionsGuard,
  ],
  exports: [WorkflowEngineService],
})
export class WorkflowEngineModule {}
