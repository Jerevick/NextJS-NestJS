import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import { AI_EMBED_CONTENT_QUEUE } from '../../queues/queue.constants';
import { EmbeddingsService } from '../embeddings.service';

export type EmbedContentJobData = {
  institutionId: string;
  entityId?: string;
  sourceType: string;
  sourceId: string;
  content: string;
  metadata?: Record<string, unknown>;
};

@Processor(AI_EMBED_CONTENT_QUEUE)
export class EmbedContentProcessor extends WorkerHost {
  private readonly log = new Logger(EmbedContentProcessor.name);

  constructor(private readonly embeddings: EmbeddingsService) {
    super();
  }

  async process(job: Job<EmbedContentJobData>): Promise<void> {
    await this.embeddings.upsertDocument(job.data);
    this.log.log(`Embedded ${job.data.sourceType}:${job.data.sourceId}`);
  }
}
