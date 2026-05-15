import { Module, forwardRef } from '@nestjs/common';
import { BillingCoreModule } from '../billing/billing-core.module';
import { EntityProvisioningService } from '../institution-entities/entity-provisioning.service';
import { InstitutionsModule } from '../institutions/institutions.module';
import { OrgStructureModule } from '../org-structure/org-structure.module';
import { WorkflowEngineModule } from '../workflow-engine/workflow-engine.module';
import { FeatureFlagsService } from './feature-flags.service';
import { InstitutionHealthService } from './institution-health.service';
import { SuperAdminBillingService } from './super-admin-billing.service';
import { SuperAdminController } from './super-admin.controller';
import { SuperAdminInstitutionsService } from './super-admin-institutions.service';
import { SuperAdminPlatformService } from './super-admin-platform.service';
import { SuperAdminGuard } from '../common/guards/super-admin.guard';

@Module({
  imports: [
    InstitutionsModule,
    BillingCoreModule,
    OrgStructureModule,
    forwardRef(() => WorkflowEngineModule),
  ],
  controllers: [SuperAdminController],
  providers: [
    SuperAdminGuard,
    EntityProvisioningService,
    InstitutionHealthService,
    SuperAdminInstitutionsService,
    SuperAdminBillingService,
    SuperAdminPlatformService,
    FeatureFlagsService,
  ],
  exports: [InstitutionHealthService],
})
export class SuperAdminModule {}
