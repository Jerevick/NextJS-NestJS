import { BullModule } from '@nestjs/bullmq';
import { DynamicModule, forwardRef, Logger, Module } from '@nestjs/common';
import { STUDENT_CSV_IMPORT_QUEUE } from '../queues/queue.constants';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { ProgressionModule } from '../progression/progression.module';
import { WorkflowEngineModule } from '../workflow-engine/workflow-engine.module';
import { GraduationClearanceController } from './graduation-clearance.controller';
import { GraduationClearanceService } from './graduation-clearance.service';
import { StudentCsvImportProcessor } from './student-csv-import.processor';
import { StudentCsvImportService } from './student-csv-import.service';
import { ReactivationRequestService } from './reactivation-request.service';
import { ReactivationRequestsController } from './reactivation-requests.controller';
import { StatusChangeService } from './status/status-change.service';
import { StudentDeletionService } from './deletion/student-deletion.service';
import { StudentsController } from './students.controller';
import { StudentsRepository } from './students.repository';
import { StudentsService } from './students.service';

const log = new Logger('StudentsModule');

@Module({})
export class StudentsModule {
  static register(): DynamicModule {
    const useBull = Boolean(process.env.REDIS_URL?.trim());
    if (!useBull) {
      log.warn(
        'REDIS_URL is not set — student CSV import jobs run synchronously in this API process (no BullMQ worker).',
      );
    }
    return {
      module: StudentsModule,
      imports: [
        forwardRef(() => WorkflowEngineModule),
        forwardRef(() => ProgressionModule),
        ...(useBull ? [BullModule.registerQueue({ name: STUDENT_CSV_IMPORT_QUEUE })] : []),
      ],
      controllers: [
        StudentsController,
        ReactivationRequestsController,
        GraduationClearanceController,
      ],
      providers: [
        StudentsService,
        StudentsRepository,
        StatusChangeService,
        StudentDeletionService,
        ReactivationRequestService,
        GraduationClearanceService,
        StudentCsvImportService,
        ...(useBull ? [StudentCsvImportProcessor] : []),
        PermissionsGuard,
      ],
      exports: [
        StudentsService,
        StatusChangeService,
        ReactivationRequestService,
        StudentDeletionService,
        GraduationClearanceService,
      ],
    };
  }
}
