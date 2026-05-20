import { Body, Controller, Get, Post, Query, UseInterceptors } from '@nestjs/common';
import { FieldsSelectionInterceptor } from '../common/interceptors/fields-selection.interceptor';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import type { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { BulkMarkAttendanceDto } from '../attendance/dto/bulk-mark-attendance.dto';
import { MobileSyncService } from './mobile-sync.service';

@ApiTags('mobile-sync')
@ApiBearerAuth('JWT')
@Controller('sync')
export class SyncController {
  constructor(private readonly sync: MobileSyncService) {}

  @Get('attendance')
  @UseInterceptors(FieldsSelectionInterceptor)
  @ApiOperation({ summary: 'Attendance records changed since timestamp (mobile offline sync)' })
  @ApiQuery({ name: 'since', required: true })
  @ApiQuery({ name: 'entityId', required: false })
  @ApiQuery({ name: 'fields', required: false, description: 'Comma-separated field whitelist' })
  attendanceSince(
    @CurrentUser() user: AuthUser,
    @Query('since') since: string,
    @Query('entityId') entityId?: string,
  ) {
    return this.sync.attendanceChangesSince(user, since, entityId);
  }

  @Post('attendance/bulk')
  @ApiOperation({ summary: 'Upload offline bulk attendance marks' })
  attendanceBulk(@CurrentUser() user: AuthUser, @Body() dto: BulkMarkAttendanceDto) {
    return this.sync.bulkUploadAttendance(user, dto);
  }
}
