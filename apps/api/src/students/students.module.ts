import { Module, forwardRef } from '@nestjs/common';
import { WorkflowEngineModule } from '../workflow-engine/workflow-engine.module';
import { StudentsController } from './students.controller';
import { StudentsRepository } from './students.repository';
import { StudentsService } from './students.service';
import { ReactivationRequestsController } from './reactivation-requests.controller';
import { ReactivationRequestService } from './reactivation-request.service';
import { StatusChangeService } from './status/status-change.service';
import { StudentDeletionService } from './deletion/student-deletion.service';
import { PermissionsGuard } from '../common/guards/permissions.guard';

@Module({
  imports: [forwardRef(() => WorkflowEngineModule)],
  controllers: [StudentsController, ReactivationRequestsController],
  providers: [
    StudentsService,
    StudentsRepository,
    StatusChangeService,
    StudentDeletionService,
    ReactivationRequestService,
    PermissionsGuard,
  ],
  exports: [StudentsService, StatusChangeService, ReactivationRequestService, StudentDeletionService],
})
export class StudentsModule {}
