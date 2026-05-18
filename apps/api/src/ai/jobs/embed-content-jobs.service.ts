import { Injectable, Logger } from '@nestjs/common';
import type { Queue } from 'bullmq';
import { EmbeddingsService } from '../embeddings.service';
import type { EmbedContentJobData } from './embed-content.processor';

@Injectable()
export class EmbedContentJobsService {
  private readonly log = new Logger(EmbedContentJobsService.name);

  constructor(
    private readonly embeddings: EmbeddingsService,
    private readonly queue: Queue<EmbedContentJobData> | null,
  ) {}

  async enqueue(data: EmbedContentJobData): Promise<void> {
    if (this.queue) {
      await this.queue.add('embed', data, {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
      });
      return;
    }
    this.log.debug('REDIS_URL unset — embedding synchronously');
    await this.embeddings.upsertDocument(data);
  }
}
