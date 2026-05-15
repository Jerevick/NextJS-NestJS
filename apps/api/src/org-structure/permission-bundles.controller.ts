import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequireAnyPermissions } from '../common/decorators/require-any-permissions.decorator';
import { AnyPermissionsGuard } from '../common/guards/any-permissions.guard';
import { PermissionBundlesService } from './permission-bundles.service';

@ApiTags('permission-bundles')
@Controller('institutions/:institutionId/permission-bundles')
export class PermissionBundlesController {
  constructor(private readonly bundles: PermissionBundlesService) {}

  @Get()
  @UseGuards(AnyPermissionsGuard)
  @RequireAnyPermissions('org.read', 'org.write', 'institutions.read')
  @ApiOperation({ summary: 'List permission bundles for institution' })
  list(@CurrentUser() user: AuthUser, @Param('institutionId') institutionId: string) {
    return this.bundles.listForInstitution(user, institutionId);
  }
}
