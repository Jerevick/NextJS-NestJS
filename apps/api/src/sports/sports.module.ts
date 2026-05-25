import { DynamicModule, Logger, Module, forwardRef } from '@nestjs/common';
import { BullModule, getQueueToken } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import { AiModule } from '../ai/ai.module';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { ProgressionModule } from '../progression/progression.module';
import { SPORTS_ELIGIBILITY_QUEUE } from '../queues/queue.constants';
import { SportsEligibilityJobsService } from './jobs/sports-eligibility-jobs.service';
import { SportsEligibilityProcessor } from './jobs/sports-eligibility.processor';
import { SportsEligibilityService } from './sports-eligibility.service';
import { SportsController } from './sports.controller';
import { SportsRepository } from './sports.repository';
import { SportsService } from './sports.service';

const log = new Logger('SportsModule');

@Module({})
export class SportsModule {
  static register(): DynamicModule {
    const useBull = Boolean(process.env.REDIS_URL?.trim());
    if (!useBull) {
      log.warn('REDIS_URL is not set — sports eligibility jobs run synchronously in-process.');
    }
    return {
      module: SportsModule,
      imports: [
        forwardRef(() => ProgressionModule),
        AiModule.register(),
        ...(useBull ? [BullModule.registerQueue({ name: SPORTS_ELIGIBILITY_QUEUE })] : []),
      ],
      controllers: [SportsController],
      providers: [
        SportsService,
        SportsRepository,
        SportsEligibilityService,
        {
          provide: SportsEligibilityJobsService,
          useFactory: (eligibility: SportsEligibilityService, queue?: Queue) =>
            new SportsEligibilityJobsService(eligibility, queue ?? null),
          inject: [
            SportsEligibilityService,
            ...(useBull ? [getQueueToken(SPORTS_ELIGIBILITY_QUEUE)] : []),
          ],
        },
        PermissionsGuard,
        ...(useBull ? [SportsEligibilityProcessor] : []),
      ],
      exports: [SportsService, SportsEligibilityService, SportsEligibilityJobsService],
    };
  }
}
