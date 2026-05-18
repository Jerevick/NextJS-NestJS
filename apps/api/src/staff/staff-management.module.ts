import { Module } from '@nestjs/common';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { StaffCalendarConnectController } from './staff-calendar-connect.controller';
import { StaffCoreModule } from './staff-core.module';
import { StaffLeaveHubController } from './staff-leave-hub.controller';
import { StaffProfilesController } from './staff-profiles.controller';
import { StaffWorkloadController } from './staff-workload.controller';

/** Staff profiles, workload, leave hub routes, calendar connect. */
@Module({
  imports: [StaffCoreModule],
  controllers: [
    StaffProfilesController,
    StaffWorkloadController,
    StaffLeaveHubController,
    StaffCalendarConnectController,
  ],
  providers: [PermissionsGuard],
  exports: [StaffCoreModule],
})
export class StaffManagementModule {}
