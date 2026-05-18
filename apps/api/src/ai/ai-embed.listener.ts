import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { EmbedContentJobsService } from './jobs/embed-content-jobs.service';

export const LMS_LESSON_EMBED_EVENT = 'lms.lesson.embed';

export type LmsLessonEmbedPayload = {
  institutionId: string;
  entityId?: string;
  courseInstanceId: string;
  lessonId: string;
  title: string;
  contentText: string;
};

export const LMS_MODULE_EMBED_EVENT = 'lms.module.embed';

export type LmsModuleEmbedPayload = {
  institutionId: string;
  entityId?: string;
  courseInstanceId: string;
  moduleId: string;
  title: string;
};

@Injectable()
export class AiEmbedListener {
  private readonly log = new Logger(AiEmbedListener.name);

  constructor(private readonly embedJobs: EmbedContentJobsService) {}

  @OnEvent(LMS_LESSON_EMBED_EVENT, { async: true })
  async onLessonEmbed(payload: LmsLessonEmbedPayload): Promise<void> {
    if (!payload.contentText.trim()) return;
    await this.embedJobs.enqueue({
      institutionId: payload.institutionId,
      entityId: payload.entityId,
      sourceType: 'lesson',
      sourceId: payload.lessonId,
      content: `${payload.title}\n\n${payload.contentText}`.slice(0, 12000),
      metadata: {
        title: payload.title,
        courseInstanceId: payload.courseInstanceId,
      },
    });
    this.log.debug(`Queued embed for lesson ${payload.lessonId}`);
  }

  @OnEvent(LMS_MODULE_EMBED_EVENT, { async: true })
  async onModuleEmbed(payload: LmsModuleEmbedPayload): Promise<void> {
    await this.embedJobs.enqueue({
      institutionId: payload.institutionId,
      entityId: payload.entityId,
      sourceType: 'lms_module',
      sourceId: payload.moduleId,
      content: payload.title,
      metadata: {
        title: payload.title,
        courseInstanceId: payload.courseInstanceId,
      },
    });
  }
}
