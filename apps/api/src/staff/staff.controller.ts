import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { CreateLeaveRequestDto } from './dto/create-leave-request.dto';
import { CreateLeaveTypeDto } from './dto/create-leave-type.dto';
import { CreateStaffAppraisalDto } from './dto/create-appraisal.dto';
import { CreateStaffProfileDto } from './dto/create-staff-profile.dto';
import { UpdateStaffProfileDto } from './dto/update-staff-profile.dto';
import { UpsertWorkloadDto } from './dto/upsert-workload.dto';
import { StaffService } from './staff.service';

@Throttle({ default: { limit: 120, ttl: 60_000 } })
@Controller('staff')
@UseGuards(PermissionsGuard)
export class StaffController {
  constructor(private readonly staff: StaffService) {}

  @Get('profiles')
  @RequirePermissions('staff.read')
  listProfiles(@CurrentUser() user: AuthUser) {
    return this.staff.listProfiles(user);
  }

  @Get('profiles/me')
  @RequirePermissions('staff.read')
  myProfile(@CurrentUser() user: AuthUser) {
    return this.staff.getMyProfile(user);
  }

  @Get('profiles/:id')
  @RequirePermissions('staff.read')
  getProfile(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.staff.getProfile(user, id);
  }

  @Post('profiles')
  @RequirePermissions('staff.write')
  createProfile(@CurrentUser() user: AuthUser, @Body() dto: CreateStaffProfileDto) {
    return this.staff.createProfile(user, dto);
  }

  @Patch('profiles/:id')
  @RequirePermissions('staff.write')
  updateProfile(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateStaffProfileDto,
  ) {
    return this.staff.updateProfile(user, id, dto);
  }

  @Get('org-chart')
  @RequirePermissions('staff.read')
  orgChart(@CurrentUser() user: AuthUser, @Query('entityId') entityId?: string) {
    const eid = entityId ?? user.entityId;
    if (!eid) {
      return { entityId: null, tree: [] };
    }
    return this.staff.orgChart(user, eid);
  }

  @Get('leave-types')
  @RequirePermissions('staff.read')
  listLeaveTypes(@CurrentUser() user: AuthUser) {
    return this.staff.listLeaveTypes(user);
  }

  @Post('leave-types')
  @RequirePermissions('staff.write')
  createLeaveType(@CurrentUser() user: AuthUser, @Body() dto: CreateLeaveTypeDto) {
    return this.staff.createLeaveType(user, dto);
  }

  @Get('leave-requests')
  @RequirePermissions('staff.read')
  listLeaveRequests(@CurrentUser() user: AuthUser, @Query('staffId') staffId?: string) {
    return this.staff.listLeaveRequests(user, staffId);
  }

  @Post('leave-requests')
  @RequirePermissions('staff.read')
  createLeaveRequest(@CurrentUser() user: AuthUser, @Body() dto: CreateLeaveRequestDto) {
    return this.staff.createLeaveRequest(user, dto);
  }

  @Get('appraisals')
  @RequirePermissions('staff.read')
  listAppraisals(@CurrentUser() user: AuthUser, @Query('staffId') staffId?: string) {
    return this.staff.listAppraisals(user, staffId);
  }

  @Post('appraisals')
  @RequirePermissions('staff.write')
  createAppraisal(@CurrentUser() user: AuthUser, @Body() dto: CreateStaffAppraisalDto) {
    return this.staff.createAppraisal(user, dto);
  }

  @Patch('appraisals/:id')
  @RequirePermissions('staff.read')
  updateAppraisal(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body()
    body: {
      selfAssessment?: string;
      kpiScores?: Record<string, unknown>;
      peerFeedback?: unknown[];
    },
  ) {
    return this.staff.updateAppraisal(user, id, body);
  }

  @Get('workload')
  @RequirePermissions('staff.read')
  listWorkload(@CurrentUser() user: AuthUser, @Query('semesterId') semesterId: string) {
    return this.staff.listWorkload(user, semesterId);
  }

  @Post('workload')
  @RequirePermissions('staff.write')
  upsertWorkload(@CurrentUser() user: AuthUser, @Body() dto: UpsertWorkloadDto) {
    return this.staff.upsertWorkload(user, dto);
  }
}
