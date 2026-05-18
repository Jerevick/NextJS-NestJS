import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import type { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { CreateLeaveRequestDto } from './dto/create-leave-request.dto';
import { CreateLeaveTypeDto } from './dto/create-leave-type.dto';
import { AllocateLeaveBalanceDto } from './dto/allocate-leave-balance.dto';
import { CarryForwardLeaveDto } from './dto/carry-forward-leave.dto';
import { RegisterExternalCalendarDto } from './dto/register-external-calendar.dto';
import { StaffLeaveDocumentsService } from './staff-leave-documents.service';
import { StaffService } from './staff.service';

@Throttle({ default: { limit: 120, ttl: 60_000 } })
@Controller('staff')
@UseGuards(PermissionsGuard)
export class StaffLeaveHubController {
  constructor(
    private readonly staff: StaffService,
    private readonly leaveDocs: StaffLeaveDocumentsService,
  ) {}

  @Post('leave-supporting-documents')
  @RequirePermissions('staff.read')
  @UseInterceptors(FileInterceptor('file'))
  uploadSupportingDocument(
    @CurrentUser() user: AuthUser,
    @Query('staffId') staffId: string,
    @UploadedFile()
    file: { buffer: Buffer; mimetype?: string; originalname?: string; size: number },
  ) {
    return this.leaveDocs.uploadSupportingDocument(user, staffId, file);
  }

  @Get('leave-requests/:id/supporting-document')
  @RequirePermissions('staff.read')
  getSupportingDocument(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.leaveDocs.getSupportingDocumentUrl(user, id);
  }

  @Get('leave-types')
  @RequirePermissions('staff.read')
  listLeaveTypes(@CurrentUser() user: AuthUser) {
    return this.staff.listLeaveTypes(user);
  }

  @Post('leave-types')
  @RequirePermissions('staff.write')
  createLeaveType(@CurrentUser() user: AuthUser, @Body() dto: CreateLeaveTypeDto) {
    return this.staff.createLeaveType(user, dto);
  }

  @Get('leave-balances')
  @RequirePermissions('staff.read')
  listLeaveBalances(@CurrentUser() user: AuthUser, @Query('staffId') staffId?: string) {
    return this.staff.listLeaveBalances(user, staffId);
  }

  @Post('leave-balances/allocate')
  @RequirePermissions('staff.write')
  allocate(@CurrentUser() user: AuthUser, @Body() dto: AllocateLeaveBalanceDto) {
    return this.staff.allocateLeaveBalance(user, dto);
  }

  @Post('leave-balances/carry-forward')
  @RequirePermissions('staff.write')
  carryForward(@CurrentUser() user: AuthUser, @Body() dto: CarryForwardLeaveDto) {
    return this.staff.carryForwardLeaveBalances(user, dto);
  }

  @Get('leave-calendar')
  @RequirePermissions('staff.read')
  leaveCalendar(
    @CurrentUser() user: AuthUser,
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    return this.staff.leaveCalendar(user, from, to);
  }

  @Get('leave-calendar/export')
  @RequirePermissions('staff.read')
  @Header('Content-Type', 'text/calendar; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="leave.ics"')
  exportLeaveCalendar(
    @CurrentUser() user: AuthUser,
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    return this.staff.exportLeaveCalendarIcs(user, from, to);
  }

  @Post('leave-requests/:id/external-calendar')
  @RequirePermissions('staff.read')
  registerExternalCalendar(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: RegisterExternalCalendarDto,
  ) {
    return this.staff.registerExternalCalendar(user, id, dto);
  }

  @Get('leave-requests')
  @RequirePermissions('staff.read')
  listLeaveRequests(@CurrentUser() user: AuthUser, @Query('staffId') staffId?: string) {
    return this.staff.listLeaveRequests(user, staffId);
  }

  @Post('leave-requests')
  @RequirePermissions('staff.read')
  createLeaveRequest(@CurrentUser() user: AuthUser, @Body() dto: CreateLeaveRequestDto) {
    return this.staff.createLeaveRequest(user, dto);
  }
}
