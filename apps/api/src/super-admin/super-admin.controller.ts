import {
  Body,
  BadRequestException,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import type { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { SuperAdminGuard } from '../common/guards/super-admin.guard';
import { ListInstitutionsQueryDto } from '../institutions/dto/list-institutions-query.dto';
import { UpdateInstitutionDto } from '../institutions/dto/update-institution.dto';
import { ResolveBillingDisputeDto } from '../billing/dto/resolve-billing-dispute.dto';
import { LockDailySnapshotsDto } from '../billing/dto/lock-daily-snapshots.dto';
import { AmendSnapshotDto } from './dto/amend-snapshot.dto';
import { InstitutionFeatureFlagDto } from './dto/institution-feature-flag.dto';
import { ProvisionInstitutionDto } from './dto/provision-institution.dto';
import { ReviewRegistrationRequestDto } from './dto/review-registration-request.dto';
import { UpdateInstitutionBillingConfigDto } from './dto/update-institution-billing-config.dto';
import { UpsertFeatureFlagDto } from './dto/upsert-feature-flag.dto';
import { FeatureFlagsService } from './feature-flags.service';
import { RegistrationReviewService } from './registration-review.service';
import { SuperAdminBillingService } from './super-admin-billing.service';
import { SuperAdminInstitutionsService } from './super-admin-institutions.service';
import { AuthRegistrationService } from '../auth/auth-registration.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PlatformSessionMetricsService } from './platform-session-metrics.service';
import { SuperAdminPlatformService } from './super-admin-platform.service';

@ApiTags('super-admin')
@ApiBearerAuth('JWT')
@Controller('super-admin')
@UseGuards(SuperAdminGuard)
export class SuperAdminController {
  constructor(
    private readonly platform: SuperAdminPlatformService,
    private readonly institutions: SuperAdminInstitutionsService,
    private readonly billing: SuperAdminBillingService,
    private readonly featureFlags: FeatureFlagsService,
    private readonly registration: AuthRegistrationService,
    private readonly registrationReview: RegistrationReviewService,
    private readonly notifications: NotificationsService,
    private readonly sessionMetrics: PlatformSessionMetricsService,
  ) {}

  @Get('overview')
  getOverview() {
    return this.platform.getOverview();
  }

  @Get('overview/mrr-trend')
  getMrrTrend() {
    return this.platform.getMrrTrend();
  }

  @Get('overview/map-pins')
  getMapPins() {
    return this.platform.getInstitutionMapPins();
  }

  @Get('overview/active-sessions')
  getActiveSessions() {
    return this.sessionMetrics.snapshot();
  }

  @Get('institutions')
  listInstitutions(@Query() query: ListInstitutionsQueryDto) {
    return this.institutions.list(query);
  }

  @Get('institutions/:id')
  getInstitution(@Param('id') id: string) {
    return this.institutions.getDetail(id);
  }

  @Post('institutions')
  provisionInstitution(@CurrentUser() user: AuthUser, @Body() dto: ProvisionInstitutionDto) {
    return this.institutions.provision(user, dto);
  }

  @Patch('institutions/:id')
  updateInstitution(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateInstitutionDto,
  ) {
    return this.institutions.update(id, dto, user);
  }

  @Patch('institutions/:id/billing-config')
  updateBillingConfig(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateInstitutionBillingConfigDto,
  ) {
    return this.institutions.updateBillingConfig(id, dto, user);
  }

  @Post('institutions/:id/suspend')
  suspendInstitution(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: { reason?: string },
  ) {
    return this.institutions.suspend(id, user, body.reason);
  }

  @Post('institutions/:id/activate')
  activateInstitution(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.institutions.activate(id, user);
  }

  @Get('billing/disputes')
  listBillingDisputes(@Query('limit') limit?: string) {
    const n = limit ? Number(limit) : 50;
    return this.billing.listPendingDisputes(Number.isFinite(n) ? n : 50);
  }

  @Post('billing/disputes/:id/resolve')
  resolveDispute(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: ResolveBillingDisputeDto,
  ) {
    return this.billing.resolveDispute(user, id, dto);
  }

  @Get('billing/institutions/:institutionId/snapshots')
  listSnapshots(
    @Param('institutionId') institutionId: string,
    @Query('year') year: string,
    @Query('month') month: string,
  ) {
    return this.billing.listInstitutionSnapshots(institutionId, Number(year), Number(month));
  }

  @Patch('billing/snapshots/:id')
  amendSnapshot(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: AmendSnapshotDto,
  ) {
    return this.billing.amendSnapshot(user, id, dto.billableCount, dto.reason);
  }

  @Post('billing/institutions/:institutionId/generate-invoice')
  generateInvoice(
    @CurrentUser() user: AuthUser,
    @Param('institutionId') institutionId: string,
    @Body() body: { year: number; month: number },
  ) {
    return this.billing.generateInvoiceForInstitution(user, institutionId, body.year, body.month);
  }

  @Post('billing/snapshots/lock')
  lockSnapshots(@CurrentUser() user: AuthUser, @Body() dto: LockDailySnapshotsDto) {
    return this.billing.lockSnapshots(user, dto);
  }

  @Get('feature-flags')
  listFeatureFlags() {
    return this.featureFlags.listGlobal();
  }

  @Post('feature-flags')
  upsertFeatureFlag(@Body() dto: UpsertFeatureFlagDto) {
    return this.featureFlags.upsertGlobal(dto);
  }

  @Post('institutions/:id/feature-flags')
  setInstitutionFeatureFlag(
    @Param('id') institutionId: string,
    @Body() dto: InstitutionFeatureFlagDto,
  ) {
    return this.featureFlags.setInstitutionOverride(institutionId, dto.flagKey, dto.enabled);
  }

  @Get('registration-requests/:id')
  async getRegistrationRequest(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const request = await this.registration.getRegistrationRequest(id);
    await this.notifications.markRegistrationRequestRead(user, id);
    return request;
  }

  @Get('registration-requests/:id/documents/:document')
  async getRegistrationDocument(
    @Param('id') id: string,
    @Param('document') document: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    if (document !== 'logo' && document !== 'accreditationEvidence') {
      throw new BadRequestException('Unknown registration document');
    }
    const file = await this.registration.getRegistrationDocument(id, document);
    res.setHeader('Content-Type', file.contentType);
    res.setHeader('Content-Disposition', `inline; filename="${file.filename}"`);
    res.setHeader('Cache-Control', 'private, max-age=300');
    return new StreamableFile(file.buffer);
  }

  @Get('registration-requests')
  listRegistrationRequests(
    @Query('status') status?: string,
    @Query('kind') kind?: string,
    @Query('limit') limit?: string,
  ) {
    return this.registration.listRegistrationRequests({
      status,
      kind,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Patch('registration-requests/:id')
  reviewRegistrationRequest(
    @CurrentUser() actor: AuthUser,
    @Param('id') id: string,
    @Body() body: ReviewRegistrationRequestDto,
  ) {
    return this.registrationReview.review(actor, id, body.status);
  }
}
