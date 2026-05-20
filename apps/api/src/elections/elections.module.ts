import { forwardRef, Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { NotificationsModule } from '../modules/notifications';
import { StorageModule } from '../storage/storage.module';
import { WorkflowEngineModule } from '../workflow-engine/workflow-engine.module';
import { MailService } from '../mail/mail.service';
import { ElectionDocumentsService } from './election-documents.service';
import { ElectionSchedulerService } from './election-scheduler.service';
import { ElectionsController } from './elections.controller';
import { ElectionsNotificationsService } from './elections-notifications.service';
import { ElectionsRepository } from './elections.repository';
import { ElectionsService } from './elections.service';

/** Phase 11 elections: blind voting, nominations, certification workflow. */
@Module({
  imports: [
    AuditModule,
    NotificationsModule.register(),
    StorageModule,
    forwardRef(() => WorkflowEngineModule),
  ],
  controllers: [ElectionsController],
  providers: [
    ElectionsService,
    ElectionsRepository,
    ElectionsNotificationsService,
    ElectionDocumentsService,
    ElectionSchedulerService,
    MailService,
    PermissionsGuard,
  ],
  exports: [ElectionsService, ElectionsRepository],
})
export class ElectionsModule {}
