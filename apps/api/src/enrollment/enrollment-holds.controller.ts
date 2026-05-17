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
import type { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { JoinWaitlistDto } from './dto/join-waitlist.dto';
import { LiftEnrollmentHoldDto } from './dto/lift-enrollment-hold.dto';
import { PlaceEnrollmentHoldDto } from './dto/place-enrollment-hold.dto';
import { EnrollmentHoldsService } from './enrollment-holds.service';

@Controller()
@UseGuards(PermissionsGuard)
export class EnrollmentHoldsController {
  constructor(private readonly holds: EnrollmentHoldsService) {}

  @Get('students/:studentId/enrollment-holds')
  @RequirePermissions('enrollments.read')
  listHolds(
    @CurrentUser() user: AuthUser,
    @Param('studentId') studentId: string,
    @Query('activeOnly') activeOnly?: string,
  ) {
    const onlyActive = activeOnly !== 'false';
    return this.holds.listForStudent(user, studentId, onlyActive);
  }

  @Post('students/:studentId/enrollment-holds')
  @RequirePermissions('enrollments.write')
  placeHold(
    @CurrentUser() user: AuthUser,
    @Param('studentId') studentId: string,
    @Body() dto: PlaceEnrollmentHoldDto,
  ) {
    return this.holds.place(user, studentId, dto);
  }

  @Patch('enrollment-holds/:holdId/lift')
  @RequirePermissions('enrollments.write')
  liftHold(
    @CurrentUser() user: AuthUser,
    @Param('holdId') holdId: string,
    @Body() dto: LiftEnrollmentHoldDto,
  ) {
    return this.holds.lift(user, holdId, dto);
  }

  @Get('sections/:sectionId/waitlist')
  @RequirePermissions('enrollments.read')
  listWaitlist(@CurrentUser() user: AuthUser, @Param('sectionId') sectionId: string) {
    return this.holds.listWaitlist(user, sectionId);
  }

  @Post('sections/:sectionId/waitlist')
  @RequirePermissions('enrollments.write')
  joinWaitlist(
    @CurrentUser() user: AuthUser,
    @Param('sectionId') sectionId: string,
    @Body() dto: JoinWaitlistDto,
  ) {
    return this.holds.joinWaitlist(user, sectionId, dto);
  }

  @Delete('waitlist/:entryId')
  @RequirePermissions('enrollments.write')
  leaveWaitlist(@CurrentUser() user: AuthUser, @Param('entryId') entryId: string) {
    return this.holds.leaveWaitlist(user, entryId);
  }
}
