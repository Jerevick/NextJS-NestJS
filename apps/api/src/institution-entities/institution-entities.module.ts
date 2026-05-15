import { DynamicModule, Logger, Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { AnyPermissionsGuard } from '../common/guards/any-permissions.guard';
import { ENTITY_PROVISIONING_QUEUE } from '../queues/queue.constants';
import { EntityProvisioningProcessor } from './entity-provisioning.processor';
import { InstitutionEntitiesController } from './institution-entities.controller';
import { InstitutionEntitiesRepository } from './institution-entities.repository';
import { EntityProvisioningService } from './entity-provisioning.service';
import { InstitutionEntitiesService } from './institution-entities.service';
import { UserEntityAccessService } from './user-entity-access.service';
import { OrgStructureModule } from '../org-structure/org-structure.module';
import { WorkflowEngineModule } from '../workflow-engine/workflow-engine.module';

const log = new Logger('InstitutionEntitiesModule');

@Module({})
export class InstitutionEntitiesModule {
  static register(): DynamicModule {
    const useBull = Boolean(process.env.REDIS_URL?.trim());
    if (!useBull) {
      log.warn(
        'REDIS_URL is not set — entity provisioning runs synchronously in the API process (no BullMQ worker). Set REDIS_URL (e.g. redis://127.0.0.1:6379) to use the background queue.',
      );
    }
    return {
      module: InstitutionEntitiesModule,
      imports: [
        OrgStructureModule,
        WorkflowEngineModule,
        ...(useBull ? [BullModule.registerQueue({ name: ENTITY_PROVISIONING_QUEUE })] : []),
      ],
      controllers: [InstitutionEntitiesController],
      providers: [
        InstitutionEntitiesService,
        InstitutionEntitiesRepository,
        EntityProvisioningService,
        UserEntityAccessService,
        AnyPermissionsGuard,
        ...(useBull ? [EntityProvisioningProcessor] : []),
      ],
      exports: [
        InstitutionEntitiesService,
        InstitutionEntitiesRepository,
        UserEntityAccessService,
        EntityProvisioningService,
      ],
    };
  }
}
