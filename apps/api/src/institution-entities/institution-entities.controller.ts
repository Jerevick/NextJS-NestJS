import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequireAnyPermissions } from '../common/decorators/require-any-permissions.decorator';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { AnyPermissionsGuard } from '../common/guards/any-permissions.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { CreateInstitutionEntityDto } from './dto/create-institution-entity.dto';
import { GrantEntityAccessDto } from './dto/grant-entity-access.dto';
import { SuspendEntityDto } from './dto/suspend-entity.dto';
import { UpdateInstitutionEntityDto } from './dto/update-institution-entity.dto';
import { InstitutionEntitiesService } from './institution-entities.service';
import { UserEntityAccessService } from './user-entity-access.service';

const READ_PERMS = [
  'institutions.read',
  'institutions.write',
  'students.read',
  'students.write',
  'billing.read',
  'billing.write',
] as const;

@ApiTags('institution-entities')
@ApiBearerAuth('JWT')
@Controller('institutions/:institutionId/entities')
export class InstitutionEntitiesController {
  constructor(
    private readonly entities: InstitutionEntitiesService,
    private readonly entityAccess: UserEntityAccessService,
  ) {}

  @Get('consolidated/stats')
  @UseGuards(AnyPermissionsGuard)
  @RequireAnyPermissions(...READ_PERMS)
  @ApiOperation({ summary: 'Consolidated campus stats (institution-wide scope)' })
  consolidatedStats(@CurrentUser() user: AuthUser, @Param('institutionId') institutionId: string) {
    return this.entities.consolidatedStats(user, institutionId);
  }

  @Get('consolidated/billable')
  @UseGuards(AnyPermissionsGuard)
  @RequireAnyPermissions(...READ_PERMS)
  consolidatedBillable(@CurrentUser() user: AuthUser, @Param('institutionId') institutionId: string) {
    return this.entities.consolidatedBillable(user, institutionId);
  }

  @Get()
  @UseGuards(AnyPermissionsGuard)
  @RequireAnyPermissions(...READ_PERMS)
  list(@CurrentUser() user: AuthUser, @Param('institutionId') institutionId: string) {
    return this.entities.listForInstitution(user, institutionId);
  }

  @Post()
  @UseGuards(PermissionsGuard)
  @RequirePermissions('institutions.write')
  @ApiOperation({ summary: 'Create campus (VC/Registrar, entityScope ALL)' })
  create(
    @CurrentUser() user: AuthUser,
    @Param('institutionId') institutionId: string,
    @Body() dto: CreateInstitutionEntityDto,
  ) {
    return this.entities.createEntity(user, institutionId, dto);
  }

  @Get(':entityId/stats')
  @UseGuards(AnyPermissionsGuard)
  @RequireAnyPermissions(...READ_PERMS)
  @ApiOperation({ summary: 'Campus stats (billable from latest snapshot when available)' })
  entityStats(
    @CurrentUser() user: AuthUser,
    @Param('institutionId') institutionId: string,
    @Param('entityId') entityId: string,
  ) {
    return this.entities.getById(user, institutionId, entityId);
  }

  @Get(':entityId/user-access')
  @UseGuards(AnyPermissionsGuard)
  @RequireAnyPermissions('institutions.read', 'institutions.write')
  listUserAccess(
    @CurrentUser() user: AuthUser,
    @Param('institutionId') institutionId: string,
    @Param('entityId') entityId: string,
  ) {
    return this.entityAccess.listForEntity(user, institutionId, entityId);
  }

  @Post(':entityId/user-access')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('institutions.write')
  grantUserAccess(
    @CurrentUser() user: AuthUser,
    @Param('institutionId') institutionId: string,
    @Param('entityId') entityId: string,
    @Body() dto: GrantEntityAccessDto,
  ) {
    return this.entityAccess.grantAccess(user, institutionId, entityId, dto.userId);
  }

  @Delete(':entityId/user-access/:userId')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('institutions.write')
  revokeUserAccess(
    @CurrentUser() user: AuthUser,
    @Param('institutionId') institutionId: string,
    @Param('entityId') entityId: string,
    @Param('userId') userId: string,
  ) {
    return this.entityAccess.revokeAccess(user, institutionId, entityId, userId);
  }

  @Post(':entityId/activate')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('institutions.write')
  @ApiOperation({ summary: 'Reactivate suspended campus or finish provisioning' })
  activate(
    @CurrentUser() user: AuthUser,
    @Param('institutionId') institutionId: string,
    @Param('entityId') entityId: string,
  ) {
    return this.entities.activateEntity(user, institutionId, entityId);
  }

  @Patch(':entityId/suspend')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('institutions.write')
  suspend(
    @CurrentUser() user: AuthUser,
    @Param('institutionId') institutionId: string,
    @Param('entityId') entityId: string,
    @Body() dto: SuspendEntityDto,
  ) {
    return this.entities.suspendEntity(user, institutionId, entityId, dto.reason);
  }

  @Patch(':entityId')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('institutions.write')
  @ApiOperation({ summary: 'Update campus metadata (not type/code)' })
  update(
    @CurrentUser() user: AuthUser,
    @Param('institutionId') institutionId: string,
    @Param('entityId') entityId: string,
    @Body() dto: UpdateInstitutionEntityDto,
  ) {
    return this.entities.updateEntity(user, institutionId, entityId, dto);
  }

  @Get(':entityId')
  @UseGuards(AnyPermissionsGuard)
  @RequireAnyPermissions(...READ_PERMS)
  getById(
    @CurrentUser() user: AuthUser,
    @Param('institutionId') institutionId: string,
    @Param('entityId') entityId: string,
  ) {
    return this.entities.getById(user, institutionId, entityId);
  }
}
