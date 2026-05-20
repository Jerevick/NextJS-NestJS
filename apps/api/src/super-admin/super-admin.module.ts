import { Module, forwardRef } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { BillingCoreModule } from '../billing/billing-core.module';
import { TenantModulesModule } from '../common/tenant-modules/tenant-modules.module';
import { EntityProvisioningService } from '../institution-entities/entity-provisioning.service';
import { InstitutionsModule } from '../institutions/institutions.module';
import { MailService } from '../mail/mail.service';
import { NotificationsModule } from '../modules/notifications';
import { OrgStructureModule } from '../org-structure/org-structure.module';
import { WorkflowEngineModule } from '../workflow-engine/workflow-engine.module';
import { FeatureFlagsService } from './feature-flags.service';
import { InstitutionHealthService } from './institution-health.service';
import { RegistrationReviewService } from './registration-review.service';
import { SuperAdminBillingService } from './super-admin-billing.service';
import { SuperAdminController } from './super-admin.controller';
import { SuperAdminInstitutionsService } from './super-admin-institutions.service';
import { SuperAdminPlatformService } from './super-admin-platform.service';
import { SuperAdminGuard } from '../common/guards/super-admin.guard';

@Module({
  imports: [
    AuthModule,
    InstitutionsModule,
    TenantModulesModule,
    BillingCoreModule,
    OrgStructureModule,
    forwardRef(() => WorkflowEngineModule),
    NotificationsModule.register(),
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
    RegistrationReviewService,
    MailService,
  ],
  exports: [InstitutionHealthService],
})
export class SuperAdminModule {}
