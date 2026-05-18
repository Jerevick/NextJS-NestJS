import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { ApplyWorkloadSuggestionsDto } from './dto/apply-workload-suggestions.dto';
import { UpsertWorkloadDto } from './dto/upsert-workload.dto';
import { StaffService } from './staff.service';

@Throttle({ default: { limit: 120, ttl: 60_000 } })
@Controller('staff')
@UseGuards(PermissionsGuard)
export class StaffWorkloadController {
  constructor(private readonly staff: StaffService) {}

  @Get('workload')
  @RequirePermissions('staff.read')
  listWorkload(@CurrentUser() user: AuthUser, @Query('semesterId') semesterId: string) {
    return this.staff.listWorkload(user, semesterId);
  }

  @Get('workload/suggest')
  @RequirePermissions('staff.write')
  suggestWorkload(
    @CurrentUser() user: AuthUser,
    @Query('semesterId') semesterId: string,
    @Query('totalHours') totalHours: string,
  ) {
    return this.staff.suggestWorkload(user, semesterId, Number(totalHours) || 0);
  }

  @Post('workload/apply-suggestions')
  @RequirePermissions('staff.write')
  applyWorkloadSuggestions(
    @CurrentUser() user: AuthUser,
    @Body() dto: ApplyWorkloadSuggestionsDto,
  ) {
    return this.staff.applyWorkloadSuggestions(user, dto);
  }

  @Post('workload')
  @RequirePermissions('staff.write')
  upsertWorkload(@CurrentUser() user: AuthUser, @Body() dto: UpsertWorkloadDto) {
    return this.staff.upsertWorkload(user, dto);
  }
}
