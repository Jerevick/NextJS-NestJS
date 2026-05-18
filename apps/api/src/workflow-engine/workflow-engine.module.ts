import { Module, forwardRef } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { BillingCoreModule } from '../billing/billing-core.module';
import { GradesModule } from '../grades/grades.module';
import { FinanceModule } from '../finance/finance.module';
import { AppraisalModule } from '../appraisal/appraisal.module';
import { ElectionsModule } from '../elections/elections.module';
import { LeaveModule } from '../leave/leave.module';
import { MeetingsModule } from '../meetings/meetings.module';
import { StaffModule } from '../staff/staff.module';
import { ProgressionModule } from '../progression/progression.module';
import { StudentsModule } from '../students/students.module';
import { WorkflowAssigneeResolver } from './workflow-assignee.resolver';
import { WorkflowCompletionHandler } from './workflow-completion.handler';
import { WorkflowEngineController } from './workflow-engine.controller';
import { WorkflowEngineService } from './workflow-engine.service';
import { WorkflowSlaScheduler } from './workflow-sla.scheduler';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { AnyPermissionsGuard } from '../common/guards/any-permissions.guard';

@Module({
  imports: [
    AuditModule,
    BillingCoreModule,
    forwardRef(() => StudentsModule),
    forwardRef(() => GradesModule),
    ProgressionModule,
    forwardRef(() => FinanceModule),
    forwardRef(() => StaffModule),
    forwardRef(() => LeaveModule),
    forwardRef(() => AppraisalModule),
    forwardRef(() => ElectionsModule),
    forwardRef(() => MeetingsModule),
  ],
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
