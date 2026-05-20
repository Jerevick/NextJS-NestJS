import { forwardRef, Module } from '@nestjs/common';
import { MailService } from '../mail/mail.service';
import { AppraisalModule } from '../appraisal/appraisal.module';
import { AppraisalRepository } from '../appraisal/appraisal.repository';
import { LeaveModule } from '../leave/leave.module';
import { LeaveRepository } from '../leave/leave.repository';
import { NotificationsModule } from '../modules/notifications';
import { StorageModule } from '../storage/storage.module';
import { WorkflowEngineModule } from '../workflow-engine/workflow-engine.module';
import { StaffCalendarIntegrationService } from './staff-calendar-integration.service';
import { StaffLeaveDocumentsService } from './staff-leave-documents.service';
import { StaffNotificationsService } from './staff-notifications.service';
import { StaffRepository } from './staff.repository';
import { StaffService } from './staff.service';

/** Shared HR services exported to management, leave, appraisal, and org-chart modules. */
@Module({
  imports: [
    NotificationsModule.register(),
    StorageModule,
    forwardRef(() => WorkflowEngineModule),
    forwardRef(() => LeaveModule),
    forwardRef(() => AppraisalModule),
  ],
  providers: [
    StaffService,
    StaffRepository,
    LeaveRepository,
    AppraisalRepository,
    StaffNotificationsService,
    StaffCalendarIntegrationService,
    StaffLeaveDocumentsService,
    MailService,
  ],
  exports: [
    StaffService,
    StaffRepository,
    StaffLeaveDocumentsService,
    StaffCalendarIntegrationService,
    StaffNotificationsService,
    forwardRef(() => LeaveModule),
    forwardRef(() => AppraisalModule),
  ],
})
export class StaffCoreModule {}
