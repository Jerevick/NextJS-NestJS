import { Module } from '@nestjs/common';
import { AppraisalModule } from '../appraisal/appraisal.module';
import { OrgChartModule } from '../org-chart/org-chart.module';
import { StaffCoreModule } from './staff-core.module';
import { StaffManagementModule } from './staff-management.module';

/** Umbrella HR module — composes management, appraisal, and org chart. */
@Module({
  imports: [StaffCoreModule, StaffManagementModule, AppraisalModule, OrgChartModule],
  exports: [StaffCoreModule, StaffManagementModule, AppraisalModule, OrgChartModule],
})
export class StaffModule {}
