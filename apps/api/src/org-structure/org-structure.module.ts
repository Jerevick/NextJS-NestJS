import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { OrgTemplatesController } from './org-templates.controller';
import { OrgTemplatesService } from './org-templates.service';
import { OrgUnitsController } from './org-units.controller';
import { OrgUnitsRepository } from './org-units.repository';
import { OrgUnitsService } from './org-units.service';
import { PermissionBundlesController } from './permission-bundles.controller';
import { PermissionBundlesService } from './permission-bundles.service';
import { PositionsController } from './positions.controller';
import { PositionsRepository } from './positions.repository';
import { PositionsService } from './positions.service';
import { PermissionsGuard } from '../common/guards/permissions.guard';

@Module({
  imports: [AuditModule],
  controllers: [
    OrgUnitsController,
    PositionsController,
    OrgTemplatesController,
    PermissionBundlesController,
  ],
  providers: [
    OrgUnitsRepository,
    OrgUnitsService,
    PositionsRepository,
    PositionsService,
    OrgTemplatesService,
    PermissionBundlesService,
    PermissionsGuard,
  ],
  exports: [OrgTemplatesService, PermissionBundlesService],
})
export class OrgStructureModule {}
