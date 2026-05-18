import { Body, Controller, Get, Param, Patch, Post, Put, Query, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { AppraisalService } from '../appraisal/appraisal.service';
import { UpsertKpiTemplateDto } from '../appraisal/dto/upsert-kpi-template.dto';
import { UpsertRoleExpectationsDto } from '../appraisal/dto/upsert-role-expectations.dto';
import { AddPeerFeedbackDto } from './dto/add-peer-feedback.dto';
import { CreateAppraisalCycleDto } from './dto/create-appraisal-cycle.dto';
import { CreateStaffAppraisalDto } from './dto/create-appraisal.dto';
import { UpdateAppraisalReviewerDto } from './dto/update-appraisal-reviewer.dto';

@Throttle({ default: { limit: 120, ttl: 60_000 } })
@Controller('staff')
@UseGuards(PermissionsGuard)
export class StaffAppraisalController {
  constructor(private readonly appraisal: AppraisalService) {}

  @Get('appraisals')
  @RequirePermissions('staff.read')
  listAppraisals(@CurrentUser() user: AuthUser, @Query('staffId') staffId?: string) {
    return this.appraisal.listAppraisals(user, staffId);
  }

  @Post('appraisals')
  @RequirePermissions('staff.write')
  createAppraisal(@CurrentUser() user: AuthUser, @Body() dto: CreateStaffAppraisalDto) {
    return this.appraisal.createAppraisal(user, dto);
  }

  @Post('appraisals/cycle')
  @RequirePermissions('staff.write')
  createAppraisalCycle(@CurrentUser() user: AuthUser, @Body() dto: CreateAppraisalCycleDto) {
    return this.appraisal.createAppraisalCycle(user, dto);
  }

  @Post('appraisals/:id/peer-feedback')
  @RequirePermissions('staff.read')
  addPeerFeedback(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: AddPeerFeedbackDto,
  ) {
    return this.appraisal.addPeerFeedback(user, id, dto);
  }

  @Post('appraisals/:id/submit')
  @RequirePermissions('staff.read')
  submitAppraisal(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.appraisal.submitAppraisal(user, id);
  }

  @Get('kpi-template')
  @RequirePermissions('staff.read')
  kpiTemplate(@CurrentUser() user: AuthUser, @Query('positionId') positionId: string) {
    return this.appraisal.getKpiTemplate(user, positionId);
  }

  @Put('kpi-template')
  @RequirePermissions('staff.write')
  upsertKpiTemplate(@CurrentUser() user: AuthUser, @Body() dto: UpsertKpiTemplateDto) {
    return this.appraisal.upsertKpiTemplate(user, dto);
  }

  @Put('role-expectations')
  @RequirePermissions('staff.write')
  upsertRoleExpectations(@CurrentUser() user: AuthUser, @Body() dto: UpsertRoleExpectationsDto) {
    return this.appraisal.upsertRoleExpectations(user, dto);
  }

  @Get('staff/:staffId/role-profile')
  @RequirePermissions('staff.read')
  staffRoleProfile(@CurrentUser() user: AuthUser, @Param('staffId') staffId: string) {
    return this.appraisal.getStaffRoleProfile(user, staffId);
  }

  @Patch('appraisals/:id/reviewer')
  @RequirePermissions('staff.write')
  updateAppraisalReviewer(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateAppraisalReviewerDto,
  ) {
    return this.appraisal.updateAppraisalReviewer(user, id, dto);
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
    return this.appraisal.updateAppraisal(user, id, body);
  }
}
