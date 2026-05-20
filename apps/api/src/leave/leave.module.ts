import { forwardRef, Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { MailService } from '../mail/mail.service';
import { NotificationsModule } from '../modules/notifications';
import { StorageModule } from '../storage/storage.module';
import { WorkflowEngineModule } from '../workflow-engine/workflow-engine.module';
import { StaffCalendarIntegrationService } from '../staff/staff-calendar-integration.service';
import { StaffLeaveDocumentsService } from '../staff/staff-leave-documents.service';
import { StaffNotificationsService } from '../staff/staff-notifications.service';
import { StaffRepository } from '../staff/staff.repository';
import { LeaveController } from './leave.controller';
import { LeaveRepository } from './leave.repository';
import { LeaveService } from './leave.service';

/** Phase 10 leave: types, balances, requests, workflow, calendar blocking. */
@Module({
  imports: [
    AuditModule,
    NotificationsModule.register(),
    StorageModule,
    forwardRef(() => WorkflowEngineModule),
  ],
  controllers: [LeaveController],
  providers: [
    LeaveService,
    LeaveRepository,
    StaffRepository,
    StaffNotificationsService,
    StaffCalendarIntegrationService,
    StaffLeaveDocumentsService,
    MailService,
    PermissionsGuard,
  ],
  exports: [LeaveService, LeaveRepository, StaffLeaveDocumentsService],
})
export class LeaveModule {}
