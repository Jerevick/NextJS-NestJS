import { DynamicModule, Logger, Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { ProgressionModule } from '../progression/progression.module';
import { BULK_ENROLLMENT_QUEUE } from '../queues/queue.constants';
import { BulkEnrollmentController } from './bulk-enrollment.controller';
import { BulkEnrollmentProcessor } from './bulk-enrollment.processor';
import { BulkEnrollmentService } from './bulk-enrollment.service';
import { RepeatEnrollmentGuard } from './repeat-enrollment.guard';
import { EnrollmentController } from './enrollment.controller';
import { EnrollmentHoldsController } from './enrollment-holds.controller';
import { EnrollmentHoldsService } from './enrollment-holds.service';
import { EnrollmentRepository } from './enrollment.repository';
import { EnrollmentService } from './enrollment.service';

const log = new Logger('EnrollmentModule');

@Module({})
export class EnrollmentModule {
  static register(): DynamicModule {
    const useBull = Boolean(process.env.REDIS_URL?.trim());
    if (!useBull) {
      log.warn(
        'REDIS_URL is not set — bulk enrollment runs synchronously in the API process (no BullMQ worker).',
      );
    }
    return {
      module: EnrollmentModule,
      imports: [
        ProgressionModule,
        ...(useBull ? [BullModule.registerQueue({ name: BULK_ENROLLMENT_QUEUE })] : []),
      ],
      controllers: [EnrollmentController, EnrollmentHoldsController, BulkEnrollmentController],
      providers: [
        EnrollmentService,
        EnrollmentHoldsService,
        BulkEnrollmentService,
        RepeatEnrollmentGuard,
        EnrollmentRepository,
        PermissionsGuard,
        ...(useBull ? [BulkEnrollmentProcessor] : []),
      ],
      exports: [EnrollmentService, EnrollmentHoldsService, BulkEnrollmentService],
    };
  }
}
