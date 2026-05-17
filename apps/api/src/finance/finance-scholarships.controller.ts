import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequireFinanceDirector } from '../common/decorators/require-finance-director.decorator';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { FinanceDirectorGuard } from './guards/finance-director.guard';
import {
  CreateFinanceScholarshipDto,
  CreateScholarshipAwardDto,
} from './dto/create-finance-scholarship.dto';
import {
  ReviewScholarshipApplicationDto,
  SubmitScholarshipApplicationDto,
} from './dto/submit-scholarship-application.dto';
import { FinanceService } from './finance.service';

@Throttle({ default: { limit: 120, ttl: 60_000 } })
@Controller('finance/scholarships')
@UseGuards(PermissionsGuard, FinanceDirectorGuard)
export class FinanceScholarshipsController {
  constructor(private readonly finance: FinanceService) {}

  @Get()
  @RequirePermissions('finance.read')
  list(@CurrentUser() user: AuthUser) {
    return this.finance.listScholarships(user);
  }

  @Post()
  @RequirePermissions('finance.write')
  @RequireFinanceDirector()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateFinanceScholarshipDto) {
    return this.finance.createScholarship(user, dto);
  }

  @Get(':scholarshipId/application-form')
  @RequirePermissions('finance.read')
  applicationForm(@CurrentUser() user: AuthUser, @Param('scholarshipId') scholarshipId: string) {
    return this.finance.getScholarshipApplicationForm(user, scholarshipId);
  }

  @Get('applications')
  @RequirePermissions('finance.read')
  listApplications(@CurrentUser() user: AuthUser, @Query('scholarshipId') scholarshipId?: string) {
    return this.finance.listScholarshipApplications(user, scholarshipId);
  }

  @Post(':scholarshipId/applications')
  @RequirePermissions('finance.read')
  submitApplication(
    @CurrentUser() user: AuthUser,
    @Param('scholarshipId') scholarshipId: string,
    @Body() dto: SubmitScholarshipApplicationDto,
  ) {
    return this.finance.submitScholarshipApplication(user, scholarshipId, dto);
  }

  @Post('applications/:applicationId/review')
  @RequirePermissions('finance.write')
  @RequireFinanceDirector()
  reviewApplication(
    @CurrentUser() user: AuthUser,
    @Param('applicationId') applicationId: string,
    @Body() dto: ReviewScholarshipApplicationDto,
  ) {
    return this.finance.reviewScholarshipApplication(user, applicationId, dto);
  }

  @Get('awards')
  @RequirePermissions('finance.read')
  listAwards(@CurrentUser() user: AuthUser, @Query('scholarshipId') scholarshipId?: string) {
    return this.finance.listScholarshipAwards(user, scholarshipId);
  }

  @Post(':scholarshipId/awards')
  @RequirePermissions('finance.write')
  @RequireFinanceDirector()
  createAward(
    @CurrentUser() user: AuthUser,
    @Param('scholarshipId') scholarshipId: string,
    @Body() dto: CreateScholarshipAwardDto,
  ) {
    return this.finance.createScholarshipAward(user, scholarshipId, dto);
  }

  @Post('awards/:awardId/disburse')
  @RequirePermissions('finance.write')
  @RequireFinanceDirector()
  disburse(@CurrentUser() user: AuthUser, @Param('awardId') awardId: string) {
    return this.finance.disburseScholarshipAward(user, awardId);
  }
}
