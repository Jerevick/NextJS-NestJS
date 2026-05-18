import { Body, Controller, Get, Param, Patch, Post, Put, Query, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { AddPeerFeedbackDto } from '../staff/dto/add-peer-feedback.dto';
import { CreateAppraisalCycleDto } from '../staff/dto/create-appraisal-cycle.dto';
import { CreateStaffAppraisalDto } from '../staff/dto/create-appraisal.dto';
import { UpdateAppraisalReviewerDto } from '../staff/dto/update-appraisal-reviewer.dto';
import { AppraisalService } from './appraisal.service';
import { UpsertKpiTemplateDto } from './dto/upsert-kpi-template.dto';
import { UpsertRoleExpectationsDto } from './dto/upsert-role-expectations.dto';

/** Phase 10 appraisal routes under `/appraisal`. */
@Throttle({ default: { limit: 120, ttl: 60_000 } })
@Controller('appraisal')
@UseGuards(PermissionsGuard)
export class AppraisalController {
  constructor(private readonly appraisal: AppraisalService) {}

  @Get()
  @RequirePermissions('staff.read')
  list(@CurrentUser() user: AuthUser, @Query('staffId') staffId?: string) {
    return this.appraisal.listAppraisals(user, staffId);
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

  @Post()
  @RequirePermissions('staff.write')
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateStaffAppraisalDto) {
    return this.appraisal.createAppraisal(user, dto);
  }

  @Post('cycle')
  @RequirePermissions('staff.write')
  createCycle(@CurrentUser() user: AuthUser, @Body() dto: CreateAppraisalCycleDto) {
    return this.appraisal.createAppraisalCycle(user, dto);
  }

  @Get(':id')
  @RequirePermissions('staff.read')
  getOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.appraisal.getAppraisal(user, id);
  }

  @Patch(':id')
  @RequirePermissions('staff.read')
  update(
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

  @Patch(':id/reviewer')
  @RequirePermissions('staff.write')
  updateReviewer(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateAppraisalReviewerDto,
  ) {
    return this.appraisal.updateAppraisalReviewer(user, id, dto);
  }

  @Post(':id/peer-feedback')
  @RequirePermissions('staff.read')
  addPeerFeedback(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: AddPeerFeedbackDto,
  ) {
    return this.appraisal.addPeerFeedback(user, id, dto);
  }

  @Post(':id/submit')
  @RequirePermissions('staff.read')
  submit(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.appraisal.submitAppraisal(user, id);
  }
}
