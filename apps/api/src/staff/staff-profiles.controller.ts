import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { CreateStaffProfileDto } from './dto/create-staff-profile.dto';
import { GrantStaffEntityAccessDto } from './dto/grant-staff-entity-access.dto';
import { ListStaffProfilesQueryDto } from './dto/list-staff-profiles-query.dto';
import { UpdateStaffProfileDto } from './dto/update-staff-profile.dto';
import { StaffService } from './staff.service';

@Throttle({ default: { limit: 120, ttl: 60_000 } })
@Controller('staff')
@UseGuards(PermissionsGuard)
export class StaffProfilesController {
  constructor(private readonly staff: StaffService) {}

  @Get('profiles')
  @RequirePermissions('staff.read')
  listProfiles(@CurrentUser() user: AuthUser, @Query() query: ListStaffProfilesQueryDto) {
    return this.staff.listProfiles(user, query);
  }

  @Get('profiles/directory')
  @RequirePermissions('staff.read')
  institutionDirectory(@CurrentUser() user: AuthUser, @Query('entityId') entityId?: string) {
    return this.staff.listProfiles(user, {
      scope: entityId ? 'entity' : 'institution',
      entityId,
    });
  }

  @Get('profiles/me')
  @RequirePermissions('staff.read')
  myProfile(@CurrentUser() user: AuthUser) {
    return this.staff.getMyProfile(user);
  }

  @Get('users/available')
  @RequirePermissions('staff.write')
  listUsersAvailable(@CurrentUser() user: AuthUser, @Query('q') q?: string) {
    return this.staff.listUsersAvailableForProfile(user, q);
  }

  @Get('workflow-inbox')
  @RequirePermissions('staff.read')
  hrWorkflowInbox(@CurrentUser() user: AuthUser) {
    return this.staff.getHrWorkflowInbox(user);
  }

  @Get('profiles/:id')
  @RequirePermissions('staff.read')
  getProfile(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Query() query: ListStaffProfilesQueryDto,
  ) {
    return this.staff.getProfile(user, id, query);
  }

  @Post('profiles')
  @RequirePermissions('staff.write')
  createProfile(@CurrentUser() user: AuthUser, @Body() dto: CreateStaffProfileDto) {
    return this.staff.createProfile(user, dto);
  }

  @Patch('profiles/:id')
  @RequirePermissions('staff.write')
  updateProfile(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateStaffProfileDto,
  ) {
    return this.staff.updateProfile(user, id, dto);
  }

  @Delete('profiles/:id')
  @RequirePermissions('staff.write')
  deleteProfile(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.staff.deleteProfile(user, id);
  }

  @Get('profiles/:id/entity-access')
  @RequirePermissions('staff.read')
  listEntityAccess(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.staff.listEntityAccess(user, id);
  }

  @Post('profiles/:id/entity-access')
  @RequirePermissions('staff.write')
  grantEntityAccess(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: GrantStaffEntityAccessDto,
  ) {
    return this.staff.grantTeachingEntityAccess(user, id, dto);
  }

  @Delete('profiles/:id/entity-access/:entityId')
  @RequirePermissions('staff.write')
  revokeEntityAccess(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('entityId') entityId: string,
  ) {
    return this.staff.revokeTeachingEntityAccess(user, id, entityId);
  }
}
