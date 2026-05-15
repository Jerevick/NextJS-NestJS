import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { ListAuditLogsQueryDto } from '../audit/dto/list-audit-logs-query.dto';
import type { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequireAnyPermissions } from '../common/decorators/require-any-permissions.decorator';
import { AnyPermissionsGuard } from '../common/guards/any-permissions.guard';
import { ListMonitoringInstitutionsDto } from './dto/list-monitoring-institutions.dto';
import { MonitoringService } from './monitoring.service';

@ApiTags('monitoring')
@ApiBearerAuth('JWT')
@Controller('monitoring')
export class MonitoringController {
  constructor(private readonly monitoring: MonitoringService) {}

  @Get('institutions')
  @UseGuards(AnyPermissionsGuard)
  @RequireAnyPermissions('institutions.read', 'institutions.write')
  listInstitutions(@CurrentUser() user: AuthUser, @Query() query: ListMonitoringInstitutionsDto) {
    return this.monitoring.listInstitutions(user, query);
  }

  @Get('institutions/:id/usage')
  @UseGuards(AnyPermissionsGuard)
  @RequireAnyPermissions('institutions.read', 'institutions.write')
  institutionUsage(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.monitoring.getInstitutionUsage(user, id);
  }

  @Get('institutions/:id/audit-log')
  @UseGuards(AnyPermissionsGuard)
  @RequireAnyPermissions('institutions.read', 'institutions.write')
  institutionAudit(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Query() query: ListAuditLogsQueryDto,
  ) {
    return this.monitoring.getInstitutionAuditLog(user, id, query);
  }
}
