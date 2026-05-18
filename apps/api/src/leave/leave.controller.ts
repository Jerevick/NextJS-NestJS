import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  Patch,
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
import { AllocateLeaveBalanceDto } from '../staff/dto/allocate-leave-balance.dto';
import { CarryForwardLeaveDto } from '../staff/dto/carry-forward-leave.dto';
import { CreateLeaveRequestDto } from '../staff/dto/create-leave-request.dto';
import { CreateLeaveTypeDto } from '../staff/dto/create-leave-type.dto';
import { RegisterExternalCalendarDto } from '../staff/dto/register-external-calendar.dto';
import { StaffLeaveDocumentsService } from '../staff/staff-leave-documents.service';
import { UpdateLeaveTypeDto } from './dto/update-leave-type.dto';
import { LeaveService } from './leave.service';

/** Phase 10 leave module — routes under /leave. */
@Throttle({ default: { limit: 120, ttl: 60_000 } })
@Controller('leave')
@UseGuards(PermissionsGuard)
export class LeaveController {
  constructor(
    private readonly leave: LeaveService,
    private readonly leaveDocs: StaffLeaveDocumentsService,
  ) {}

  @Post('supporting-documents')
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

  @Get('requests/:id/supporting-document')
  @RequirePermissions('staff.read')
  getSupportingDocument(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.leaveDocs.getSupportingDocumentUrl(user, id);
  }

  @Get('types')
  @RequirePermissions('staff.read')
  listTypes(@CurrentUser() user: AuthUser) {
    return this.leave.listLeaveTypes(user);
  }

  @Post('types')
  @RequirePermissions('staff.write')
  createType(@CurrentUser() user: AuthUser, @Body() dto: CreateLeaveTypeDto) {
    return this.leave.createLeaveType(user, dto);
  }

  @Patch('types/:id')
  @RequirePermissions('staff.write')
  updateType(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateLeaveTypeDto,
  ) {
    return this.leave.updateLeaveType(user, id, dto);
  }

  @Get('balances')
  @RequirePermissions('staff.read')
  listBalances(@CurrentUser() user: AuthUser, @Query('staffId') staffId?: string) {
    return this.leave.listLeaveBalances(user, staffId);
  }

  @Post('balances/allocate')
  @RequirePermissions('staff.write')
  allocate(@CurrentUser() user: AuthUser, @Body() dto: AllocateLeaveBalanceDto) {
    return this.leave.allocateLeaveBalance(user, dto);
  }

  @Post('balances/carry-forward')
  @RequirePermissions('staff.write')
  carryForward(@CurrentUser() user: AuthUser, @Body() dto: CarryForwardLeaveDto) {
    return this.leave.carryForwardLeaveBalances(user, dto);
  }

  @Get('requests')
  @RequirePermissions('staff.read')
  listRequests(@CurrentUser() user: AuthUser, @Query('staffId') staffId?: string) {
    return this.leave.listLeaveRequests(user, staffId);
  }

  @Get('requests/:id')
  @RequirePermissions('staff.read')
  getRequest(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.leave.getLeaveRequest(user, id);
  }

  @Post('requests')
  @RequirePermissions('staff.read')
  createRequest(@CurrentUser() user: AuthUser, @Body() dto: CreateLeaveRequestDto) {
    return this.leave.createLeaveRequest(user, dto);
  }

  @Post('requests/:id/external-calendar')
  @RequirePermissions('staff.read')
  registerExternalCalendar(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: RegisterExternalCalendarDto,
  ) {
    return this.leave.registerExternalCalendar(user, id, dto);
  }

  @Get('calendar')
  @RequirePermissions('staff.read')
  calendar(@CurrentUser() user: AuthUser, @Query('from') from: string, @Query('to') to: string) {
    return this.leave.leaveCalendar(user, from, to);
  }

  @Get('calendar/export')
  @RequirePermissions('staff.read')
  @Header('Content-Type', 'text/calendar; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="leave.ics"')
  exportCalendar(
    @CurrentUser() user: AuthUser,
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    return this.leave.exportLeaveCalendarIcs(user, from, to);
  }
}
