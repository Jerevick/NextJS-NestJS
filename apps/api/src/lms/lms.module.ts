import { DynamicModule, Logger, Module } from '@nestjs/common';
import { BullModule, getQueueToken } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { PrismaModule } from '../prisma/prisma.module';
import { LMS_TRANSCODE_QUEUE } from '../queues/queue.constants';
import { StorageModule } from '../storage/storage.module';
import { LmsTranscodeProcessor } from './jobs/lms-transcode.processor';
import { LmsTranscodeJobsService } from './jobs/lms-transcode-jobs.service';
import { LmsController } from './lms.controller';
import { LmsRepository } from './lms.repository';
import { LmsScormController } from './lms-scorm.controller';
import { LmsScormService } from './lms-scorm.service';
import { LmsSharedModule } from './lms-shared.module';
import { LmsService } from './lms.service';
import { LmsTranscodeService } from './lms-transcode.service';

const log = new Logger('LmsFeatureModule');

@Module({})
export class LmsFeatureModule {
  static register(): DynamicModule {
    const useBull = Boolean(process.env.REDIS_URL?.trim());
    if (!useBull) {
      log.warn('REDIS_URL is not set — LMS transcode jobs run synchronously in-process.');
    }
    return {
      module: LmsFeatureModule,
      imports: [
        LmsSharedModule,
        PrismaModule,
        StorageModule,
        ...(useBull ? [BullModule.registerQueue({ name: LMS_TRANSCODE_QUEUE })] : []),
      ],
      controllers: [LmsController, LmsScormController],
      providers: [
        LmsService,
        LmsRepository,
        LmsScormService,
        LmsTranscodeService,
        {
          provide: LmsTranscodeJobsService,
          useFactory: (transcode: LmsTranscodeService, queue?: Queue) =>
            new LmsTranscodeJobsService(transcode, queue ?? undefined),
          inject: [LmsTranscodeService, ...(useBull ? [getQueueToken(LMS_TRANSCODE_QUEUE)] : [])],
        },
        PermissionsGuard,
        ...(useBull ? [LmsTranscodeProcessor] : []),
      ],
      exports: [LmsService, LmsScormService, LmsTranscodeJobsService],
    };
  }
}
