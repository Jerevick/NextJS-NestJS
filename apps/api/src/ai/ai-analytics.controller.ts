import { Controller, ForbiddenException, Param, Post, UseGuards } from '@nestjs/common';
import type { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequireAnyPermissions } from '../common/decorators/require-any-permissions.decorator';
import { AnyPermissionsGuard } from '../common/guards/any-permissions.guard';
import { AiAdminAnalyticsService } from './ai-admin-analytics.service';
import { AiBillingAnomalyService } from './ai-billing-anomaly.service';
import { AiDropoutService } from './ai-dropout.service';

@Controller('ai/analytics')
@UseGuards(AnyPermissionsGuard)
export class AiAnalyticsController {
  constructor(
    private readonly admin: AiAdminAnalyticsService,
    private readonly dropout: AiDropoutService,
    private readonly billingAnomalies: AiBillingAnomalyService,
  ) {}

  private assertInstitution(user: AuthUser, institutionId: string) {
    if (user.institutionId !== institutionId && !user.permissions?.includes('*')) {
      throw new ForbiddenException();
    }
  }

  /** Cross-entity weekly narrative (VC). */
  @Post('narrative/:institutionId')
  @RequireAnyPermissions('institutions.read', 'institutions.write', 'billing.read')
  institutionNarrative(
    @CurrentUser() user: AuthUser,
    @Param('institutionId') institutionId: string,
  ) {
    this.assertInstitution(user, institutionId);
    return this.admin.weeklyNarrative(institutionId);
  }

  /** Single-entity weekly narrative (Principal). */
  @Post('narrative/:institutionId/:entityId')
  @RequireAnyPermissions('institutions.read', 'institutions.write', 'billing.read')
  entityNarrative(
    @CurrentUser() user: AuthUser,
    @Param('institutionId') institutionId: string,
    @Param('entityId') entityId: string,
  ) {
    this.assertInstitution(user, institutionId);
    return this.admin.weeklyNarrative(institutionId, entityId);
  }

  /** Billing anomaly — 7d/30d snapshot drops over 10% (UniCore ops alert). */
  @Post('billing-anomaly/:institutionId')
  @RequireAnyPermissions('billing.read', 'institutions.write')
  billingAnomaly(@CurrentUser() user: AuthUser, @Param('institutionId') institutionId: string) {
    this.assertInstitution(user, institutionId);
    return this.billingAnomalies.detectInstitutionAnomalies(institutionId);
  }

  /** Dropout / at-risk prediction — institution-wide with per-entity breakdown. */
  @Post('dropout/:institutionId')
  @RequireAnyPermissions('institutions.read', 'institutions.write', 'students.read')
  institutionDropout(@CurrentUser() user: AuthUser, @Param('institutionId') institutionId: string) {
    this.assertInstitution(user, institutionId);
    return this.dropout.assessConsolidated(institutionId);
  }

  @Post('dropout/:institutionId/:entityId')
  @RequireAnyPermissions('institutions.read', 'institutions.write', 'students.read')
  entityDropout(
    @CurrentUser() user: AuthUser,
    @Param('institutionId') institutionId: string,
    @Param('entityId') entityId: string,
  ) {
    this.assertInstitution(user, institutionId);
    return this.dropout.assess(institutionId, entityId);
  }
}
