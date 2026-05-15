import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import { ENTITY_PROVISIONING_QUEUE } from '../queues/queue.constants';
import { EntityProvisioningService } from './entity-provisioning.service';

export type EntityProvisioningJobData = {
  institutionId: string;
  entityId: string;
};

@Processor(ENTITY_PROVISIONING_QUEUE)
export class EntityProvisioningProcessor extends WorkerHost {
  private readonly log = new Logger(EntityProvisioningProcessor.name);

  constructor(private readonly provisioning: EntityProvisioningService) {
    super();
  }

  async process(job: Job<EntityProvisioningJobData>): Promise<void> {
    const { institutionId, entityId } = job.data;
    const result = await this.provisioning.provisionEntity(institutionId, entityId);
    if (!result) {
      this.log.warn(`entity.provision skipped (not PROVISIONING or missing) entity=${entityId}`);
    }
  }
}
