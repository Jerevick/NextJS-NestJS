import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequireAnyPermissions } from '../common/decorators/require-any-permissions.decorator';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { AnyPermissionsGuard } from '../common/guards/any-permissions.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { AppointPositionDto } from './dto/appoint-position.dto';
import { CreatePositionDto } from './dto/create-position.dto';
import { ListPositionsQueryDto } from './dto/list-positions-query.dto';
import { PositionsService } from './positions.service';

@ApiTags('positions')
@Controller('positions')
export class PositionsController {
  constructor(private readonly positions: PositionsService) {}

  @Get()
  @UseGuards(AnyPermissionsGuard)
  @RequireAnyPermissions('org.read', 'org.write', 'institutions.read')
  @ApiOperation({ summary: 'List positions with current holder' })
  list(@CurrentUser() user: AuthUser, @Query() query: ListPositionsQueryDto) {
    const vacantOnly = query.vacantOnly === 'true' || query.vacantOnly === '1';
    return this.positions.list(user, user.institutionId, query.entityId, vacantOnly);
  }

  @Get('vacant')
  @UseGuards(AnyPermissionsGuard)
  @RequireAnyPermissions('org.read', 'org.write', 'institutions.read')
  @ApiOperation({ summary: 'Vacant positions only' })
  listVacant(@CurrentUser() user: AuthUser, @Query() query: ListPositionsQueryDto) {
    return this.positions.list(user, user.institutionId, query.entityId, true);
  }

  @Post()
  @UseGuards(PermissionsGuard)
  @RequirePermissions('org.write')
  create(@CurrentUser() user: AuthUser, @Body() dto: CreatePositionDto) {
    return this.positions.create(user, user.institutionId, dto);
  }

  @Post(':entityId/:id/appoint')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('org.write')
  appoint(
    @CurrentUser() user: AuthUser,
    @Param('entityId') entityId: string,
    @Param('id') id: string,
    @Body() dto: AppointPositionDto,
  ) {
    return this.positions.appoint(user, user.institutionId, entityId, id, dto);
  }

  @Post(':entityId/:id/handover')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('org.write')
  handover(
    @CurrentUser() user: AuthUser,
    @Param('entityId') entityId: string,
    @Param('id') id: string,
    @Body() dto: AppointPositionDto,
  ) {
    return this.positions.handover(user, user.institutionId, entityId, id, dto);
  }
}
