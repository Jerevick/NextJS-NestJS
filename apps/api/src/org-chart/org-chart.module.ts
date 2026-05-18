import { Module } from '@nestjs/common';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { StaffOrgChartController } from '../staff/staff-org-chart.controller';
import { OrgChartRepository } from './org-chart.repository';
import { OrgChartService } from './org-chart.service';

/** Phase 10 org chart: directory tree from OrgUnit + PositionHolder (`GET /staff/org-chart`). */
@Module({
  controllers: [StaffOrgChartController],
  providers: [OrgChartService, OrgChartRepository, PermissionsGuard],
  exports: [OrgChartService, OrgChartRepository],
})
export class OrgChartModule {}
