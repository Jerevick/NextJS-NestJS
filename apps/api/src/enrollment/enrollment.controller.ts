import { Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import type { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { StudentRecordWrite } from '../common/decorators/student-record-write.decorator';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { CreateEnrollmentDto } from './dto/create-enrollment.dto';
import { ListEnrollmentsQueryDto } from './dto/list-enrollments-query.dto';
import { EnrollmentService } from './enrollment.service';

@Controller('enrollments')
@UseGuards(PermissionsGuard)
export class EnrollmentController {
  constructor(private readonly enrollment: EnrollmentService) {}

  @Get()
  @RequirePermissions('enrollments.read')
  list(@CurrentUser() user: AuthUser, @Query() query: ListEnrollmentsQueryDto) {
    return this.enrollment.list(user, query);
  }

  @Get('conflicts/preview')
  @RequirePermissions('enrollments.read')
  previewConflicts(
    @CurrentUser() user: AuthUser,
    @Query('studentId') studentId: string,
    @Query('sectionId') sectionId: string,
  ) {
    return this.enrollment.previewTimetableConflicts(user, studentId, sectionId);
  }

  @Get(':id')
  @RequirePermissions('enrollments.read')
  getById(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.enrollment.getById(user, id);
  }

  @Post()
  @RequirePermissions('enrollments.write')
  @StudentRecordWrite({ mode: 'bodyStudentId', studentIdField: 'studentId' })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateEnrollmentDto) {
    return this.enrollment.create(user, dto);
  }

  @Delete(':id')
  @RequirePermissions('enrollments.write')
  @StudentRecordWrite({ mode: 'enrollmentIdParam', param: 'id' })
  drop(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.enrollment.drop(user, id);
  }
}
