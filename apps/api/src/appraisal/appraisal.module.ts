import { forwardRef, Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { WorkflowEngineModule } from '../workflow-engine/workflow-engine.module';
import { StaffRepository } from '../staff/staff.repository';
import { AppraisalController } from './appraisal.controller';
import { StaffAppraisalController } from '../staff/staff-appraisal.controller';
import { AppraisalRepository } from './appraisal.repository';
import { AppraisalService } from './appraisal.service';

/** Phase 10 appraisal: KPI templates, cycles, 360 feedback, STAFF_APPRAISAL workflow. */
@Module({
  imports: [AuditModule, forwardRef(() => WorkflowEngineModule)],
  controllers: [AppraisalController, StaffAppraisalController],
  providers: [AppraisalService, AppraisalRepository, StaffRepository, PermissionsGuard],
  exports: [AppraisalService, AppraisalRepository],
})
export class AppraisalModule {}
