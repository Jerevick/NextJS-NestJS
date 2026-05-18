import { Controller, ForbiddenException, Param, Post, UseGuards } from '@nestjs/common';
import type { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { AiBillingAnomalyService } from './ai-billing-anomaly.service';

@Controller('ai/billing')
@UseGuards(PermissionsGuard)
export class AiBillingController {
  constructor(private readonly anomalies: AiBillingAnomalyService) {}

  @Post('anomaly/:institutionId')
  @RequirePermissions('billing.read')
  detect(@CurrentUser() user: AuthUser, @Param('institutionId') institutionId: string) {
    if (user.institutionId !== institutionId) {
      throw new ForbiddenException();
    }
    return this.anomalies.detectInstitutionAnomalies(institutionId);
  }
}
