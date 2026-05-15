import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequireAnyPermissions } from '../common/decorators/require-any-permissions.decorator';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { AnyPermissionsGuard } from '../common/guards/any-permissions.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { CreateOrgUnitDto } from './dto/create-org-unit.dto';
import { OrgUnitTreeQueryDto } from './dto/org-unit-tree-query.dto';
import { UpdateOrgUnitDto } from './dto/update-org-unit.dto';
import { OrgUnitsService } from './org-units.service';

@ApiTags('org-units')
@Controller('org-units')
export class OrgUnitsController {
  constructor(private readonly orgUnits: OrgUnitsService) {}

  @Get('tree')
  @UseGuards(AnyPermissionsGuard)
  @RequireAnyPermissions('org.read', 'org.write', 'institutions.read')
  @ApiOperation({ summary: 'Nested org unit tree for one campus' })
  getTree(
    @CurrentUser() user: AuthUser,
    @Query() query: OrgUnitTreeQueryDto,
  ) {
    return this.orgUnits.getTree(user, user.institutionId, query.entityId);
  }

  @Get('institution-tree')
  @UseGuards(AnyPermissionsGuard)
  @RequireAnyPermissions('org.read', 'org.write', 'institutions.read')
  @ApiOperation({ summary: 'All campus org trees (entityScope ALL)' })
  getInstitutionTree(@CurrentUser() user: AuthUser) {
    return this.orgUnits.getInstitutionTree(user, user.institutionId);
  }

  @Post()
  @UseGuards(PermissionsGuard)
  @RequirePermissions('org.write')
  @ApiOperation({ summary: 'Create org unit' })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateOrgUnitDto) {
    return this.orgUnits.create(user, user.institutionId, dto);
  }

  @Patch(':entityId/:id')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('org.write')
  update(
    @CurrentUser() user: AuthUser,
    @Param('entityId') entityId: string,
    @Param('id') id: string,
    @Body() dto: UpdateOrgUnitDto,
  ) {
    return this.orgUnits.update(user, user.institutionId, entityId, id, dto);
  }

  @Delete(':entityId/:id')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('org.write')
  remove(
    @CurrentUser() user: AuthUser,
    @Param('entityId') entityId: string,
    @Param('id') id: string,
  ) {
    return this.orgUnits.remove(user, user.institutionId, entityId, id);
  }
}
