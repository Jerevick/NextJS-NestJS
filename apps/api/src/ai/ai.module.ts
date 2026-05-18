import { DynamicModule, Logger, Module } from '@nestjs/common';
import { BullModule, getQueueToken } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import { AnyPermissionsGuard } from '../common/guards/any-permissions.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { LmsSharedModule } from '../lms/lms-shared.module';
import { PrismaModule } from '../prisma/prisma.module';
import { MeetingsModule } from '../meetings/meetings.module';
import { AI_EMBED_CONTENT_QUEUE } from '../queues/queue.constants';
import { AiAdvisorController } from './ai-advisor.controller';
import { AiAdvisorService } from './ai-advisor.service';
import { AiAdminAnalyticsService } from './ai-admin-analytics.service';
import { AiAnalyticsController } from './ai-analytics.controller';
import { AiBillingAnomalyService } from './ai-billing-anomaly.service';
import { AiBillingController } from './ai-billing.controller';
import { AiContentController } from './ai-content.controller';
import { AiContentService } from './ai-content.service';
import { AiDropoutService } from './ai-dropout.service';
import { AiEmbedListener } from './ai-embed.listener';
import { AiEssayController } from './ai-essay.controller';
import { AiEssayService } from './ai-essay.service';
import { AiMeetingsController } from './ai-meetings.controller';
import { AiMeetingsMinutesService } from './ai-meetings-minutes.service';
import { TutorAccessGuard } from './guards/tutor-access.guard';
import { AiTimetablingController } from './ai-timetabling.controller';
import { TimetablingService } from './timetabling.service';
import { AiTutorController } from './ai-tutor.controller';
import { AiTutorService } from './ai-tutor.service';
import { AiService } from './ai.service';
import { EmbeddingsService } from './embeddings.service';
import { EmbedContentProcessor } from './jobs/embed-content.processor';
import { EmbedContentJobsService } from './jobs/embed-content-jobs.service';
import { AnthropicProvider } from './providers/anthropic.provider';
import { OpenAIProvider } from './providers/openai.provider';

const log = new Logger('AiModule');

@Module({})
export class AiModule {
  static register(): DynamicModule {
    const useBull = Boolean(process.env.REDIS_URL?.trim());
    if (!useBull) {
      log.warn('REDIS_URL is not set — AI embed jobs run synchronously in-process.');
    }
    return {
      module: AiModule,
      imports: [
        PrismaModule,
        MeetingsModule,
        LmsSharedModule,
        ...(useBull ? [BullModule.registerQueue({ name: AI_EMBED_CONTENT_QUEUE })] : []),
      ],
      controllers: [
        AiMeetingsController,
        AiTutorController,
        AiAdvisorController,
        AiContentController,
        AiAnalyticsController,
        AiEssayController,
        AiTimetablingController,
        AiBillingController,
      ],
      providers: [
        AiService,
        AiTutorService,
        AiAdvisorService,
        AiContentService,
        AiDropoutService,
        AiAdminAnalyticsService,
        AiMeetingsMinutesService,
        AiEssayService,
        TutorAccessGuard,
        AiBillingAnomalyService,
        TimetablingService,
        EmbeddingsService,
        {
          provide: EmbedContentJobsService,
          useFactory: (embeddings: EmbeddingsService, queue?: Queue) =>
            new EmbedContentJobsService(embeddings, queue ?? null),
          inject: [EmbeddingsService, ...(useBull ? [getQueueToken(AI_EMBED_CONTENT_QUEUE)] : [])],
        },
        AiEmbedListener,
        OpenAIProvider,
        AnthropicProvider,
        PermissionsGuard,
        AnyPermissionsGuard,
        ...(useBull ? [EmbedContentProcessor] : []),
      ],
      exports: [AiService, EmbeddingsService, EmbedContentJobsService, TimetablingService],
    };
  }
}
