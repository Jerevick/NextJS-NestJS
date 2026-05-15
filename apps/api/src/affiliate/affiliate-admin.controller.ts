import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequireAnyPermissions } from '../common/decorators/require-any-permissions.decorator';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { AnyPermissionsGuard } from '../common/guards/any-permissions.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { AffiliateService } from './affiliate.service';
import { CreateAffiliatePartnerDto } from './dto/create-affiliate-partner.dto';

@ApiTags('affiliate')
@ApiBearerAuth('JWT')
@Controller('institutions/:institutionId/affiliate-partners')
export class AffiliateAdminController {
  constructor(private readonly affiliate: AffiliateService) {}

  @Get()
  @UseGuards(AnyPermissionsGuard)
  @RequireAnyPermissions('institutions.read', 'institutions.write')
  list(@CurrentUser() user: AuthUser, @Param('institutionId') institutionId: string) {
    return this.affiliate.listPartners(user, institutionId);
  }

  @Post()
  @UseGuards(PermissionsGuard)
  @RequirePermissions('institutions.write')
  create(
    @CurrentUser() user: AuthUser,
    @Param('institutionId') institutionId: string,
    @Body() dto: CreateAffiliatePartnerDto,
  ) {
    return this.affiliate.createLink(user, institutionId, dto.label, dto.entityId);
  }

  @Delete(':partnerId')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('institutions.write')
  revoke(
    @CurrentUser() user: AuthUser,
    @Param('institutionId') institutionId: string,
    @Param('partnerId') partnerId: string,
  ) {
    return this.affiliate.revokeLink(user, institutionId, partnerId);
  }
}
