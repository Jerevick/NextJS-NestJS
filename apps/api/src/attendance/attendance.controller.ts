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
import { StudentRecordWrite } from '../common/decorators/student-record-write.decorator';
import { RequireAnyPermissions } from '../common/decorators/require-any-permissions.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { AnyPermissionsGuard } from '../common/guards/any-permissions.guard';
import { AttendanceService } from './attendance.service';
import { BulkMarkAttendanceDto } from './dto/bulk-mark-attendance.dto';
import { IssueSessionQrDto } from './dto/issue-session-qr.dto';
import { ListAttendanceQueryDto } from './dto/list-attendance-query.dto';
import { MarkAttendanceDto } from './dto/mark-attendance.dto';
import { SelfCheckInAttendanceDto } from './dto/self-check-in-attendance.dto';
import { UpdateAttendanceDto } from './dto/update-attendance.dto';

@Controller('attendance')
@UseGuards(AnyPermissionsGuard)
export class AttendanceController {
  constructor(private readonly attendance: AttendanceService) {}

  @Get('students/:studentId/summary')
  @RequireAnyPermissions('attendance.read', 'attendance.write', 'students.read')
  studentSummary(@CurrentUser() user: AuthUser, @Param('studentId') studentId: string) {
    return this.attendance.studentSummary(user, studentId);
  }

  @Get('sections/:sectionId')
  @RequireAnyPermissions('attendance.read', 'attendance.write', 'attendance.enter')
  listForSection(
    @CurrentUser() user: AuthUser,
    @Param('sectionId') sectionId: string,
    @Query() query: ListAttendanceQueryDto,
  ) {
    return this.attendance.listForSection(user, sectionId, query);
  }

  @Post('sections/:sectionId/session-qr')
  @RequireAnyPermissions('attendance.write', 'attendance.enter')
  issueSessionQr(
    @CurrentUser() user: AuthUser,
    @Param('sectionId') sectionId: string,
    @Body() dto: IssueSessionQrDto,
  ) {
    return this.attendance.issueSessionQr(user, sectionId, dto);
  }

  @Post('self-check-in')
  @Roles('STUDENT')
  @StudentRecordWrite({ mode: 'attendanceSelfScanToken', tokenField: 'token' })
  selfCheckIn(@CurrentUser() user: AuthUser, @Body() dto: SelfCheckInAttendanceDto) {
    return this.attendance.selfCheckIn(user, dto);
  }

  @Post('bulk')
  @RequireAnyPermissions('attendance.write', 'attendance.enter')
  @StudentRecordWrite({
    mode: 'bulkBodyAttendance',
    entriesField: 'entries',
    studentIdField: 'studentId',
    sessionDateField: 'sessionDate',
  })
  markBulk(@CurrentUser() user: AuthUser, @Body() dto: BulkMarkAttendanceDto) {
    return this.attendance.markBulk(user, dto);
  }

  @Post()
  @RequireAnyPermissions('attendance.write', 'attendance.enter')
  @StudentRecordWrite({
    mode: 'bodyStudentId',
    studentIdField: 'studentId',
    recordDate: { kind: 'bodyField', field: 'sessionDate' },
  })
  mark(@CurrentUser() user: AuthUser, @Body() dto: MarkAttendanceDto) {
    return this.attendance.mark(user, dto);
  }

  @Patch(':id')
  @RequireAnyPermissions('attendance.write', 'attendance.enter')
  @StudentRecordWrite({ mode: 'attendanceIdParam', param: 'id' })
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateAttendanceDto) {
    return this.attendance.update(user, id, dto);
  }

  @Delete(':id')
  @RequireAnyPermissions('attendance.write', 'attendance.enter')
  @StudentRecordWrite({ mode: 'attendanceIdParam', param: 'id' })
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.attendance.remove(user, id);
  }
}
