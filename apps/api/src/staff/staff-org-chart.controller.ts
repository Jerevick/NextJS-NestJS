import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { OrgChartService } from '../org-chart/org-chart.service';

@Throttle({ default: { limit: 120, ttl: 60_000 } })
@Controller('staff')
@UseGuards(PermissionsGuard)
export class StaffOrgChartController {
  constructor(private readonly orgChartService: OrgChartService) {}

  @Get('org-chart')
  @RequirePermissions('staff.read')
  getOrgChart(@CurrentUser() user: AuthUser, @Query('entityId') entityId?: string) {
    const eid = entityId ?? user.entityId;
    if (!eid) {
      return { entityId: null, entity: null, tree: [] };
    }
    return this.orgChartService.orgChart(user, eid);
  }
}
