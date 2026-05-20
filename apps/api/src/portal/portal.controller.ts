import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import type { AuthUser } from '../auth/auth.types';
import { UpdateAlumniProfileDto } from '../alumni/dto/update-alumni-profile.dto';
import { CreateEnrollmentDto } from '../enrollment/dto/create-enrollment.dto';
import { RequestStudentDocumentDto } from './dto/request-student-document.dto';
import { PortalAlumniService } from './portal-alumni.service';
import { PortalService } from './portal.service';

@Controller('portal')
export class PortalController {
  constructor(
    private readonly portal: PortalService,
    private readonly portalAlumni: PortalAlumniService,
  ) {}

  @Get('student/profile')
  studentProfile(@CurrentUser() user: AuthUser) {
    return this.portal.getStudentProfile(user);
  }

  @Get('student/dashboard')
  studentDashboard(@CurrentUser() user: AuthUser) {
    return this.portal.getStudentDashboard(user);
  }

  @Get('student/grades')
  studentGrades(@CurrentUser() user: AuthUser) {
    return this.portal.getStudentGrades(user);
  }

  @Get('student/attendance')
  studentAttendance(@CurrentUser() user: AuthUser) {
    return this.portal.getStudentAttendance(user);
  }

  @Get('student/documents')
  studentDocuments(@CurrentUser() user: AuthUser) {
    return this.portal.getStudentDocuments(user);
  }

  @Post('student/documents/request')
  requestStudentDocument(@CurrentUser() user: AuthUser, @Body() dto: RequestStudentDocumentDto) {
    return this.portal.requestStudentDocument(user, dto);
  }

  @Get('student/lms/courses')
  studentLmsCourses(
    @CurrentUser() user: AuthUser,
    @Query('limit') limit?: string,
    @Query('includeStudentSnapshot') includeStudentSnapshot?: string,
  ) {
    return this.portal.getStudentLmsCourses(user, {
      limit: limit ? Number(limit) : undefined,
      includeStudentSnapshot: includeStudentSnapshot !== 'false',
    });
  }

  @Get('student/finance')
  studentFinance(@CurrentUser() user: AuthUser) {
    return this.portal.getStudentFinance(user);
  }

  @Get('student/finance/excess-credit')
  studentExcessCredit(@CurrentUser() user: AuthUser) {
    return this.portal.getStudentExcessCredit(user);
  }

  @Get('student/registration-catalog')
  registrationCatalog(@CurrentUser() user: AuthUser, @Query('semesterId') semesterId?: string) {
    return this.portal.getRegistrationCatalog(user, semesterId);
  }

  @Post('student/enrollments')
  enrollSelf(@CurrentUser() user: AuthUser, @Body() dto: CreateEnrollmentDto) {
    return this.portal.enrollSelf(user, dto);
  }

  @Get('guardian/students')
  guardianStudents(@CurrentUser() user: AuthUser) {
    return this.portal.listGuardianStudents(user);
  }

  @Get('guardian/students/:studentId')
  guardianStudent(@CurrentUser() user: AuthUser, @Param('studentId') studentId: string) {
    return this.portal.getGuardianStudent(user, studentId);
  }

  @Get('guardian/students/:studentId/academic')
  guardianAcademic(@CurrentUser() user: AuthUser, @Param('studentId') studentId: string) {
    return this.portal.getGuardianStudentAcademic(user, studentId);
  }

  @Get('guardian/students/:studentId/attendance')
  guardianAttendance(@CurrentUser() user: AuthUser, @Param('studentId') studentId: string) {
    return this.portal.getGuardianStudentAttendance(user, studentId);
  }

  @Get('guardian/students/:studentId/finance')
  guardianFinance(@CurrentUser() user: AuthUser, @Param('studentId') studentId: string) {
    return this.portal.getGuardianStudentFinance(user, studentId);
  }

  @Get('alumni/profile')
  @Roles('ALUMNI')
  alumniProfile(@CurrentUser() user: AuthUser) {
    return this.portalAlumni.getProfile(user);
  }

  @Post('alumni/profile')
  @Roles('ALUMNI')
  alumniSaveProfile(@CurrentUser() user: AuthUser, @Body() dto: UpdateAlumniProfileDto) {
    return this.portalAlumni.saveProfile(user, dto);
  }

  @Get('alumni/events')
  @Roles('ALUMNI')
  alumniEvents(@CurrentUser() user: AuthUser) {
    return this.portalAlumni.listEvents(user);
  }

  @Post('alumni/events/:eventId/register')
  @Roles('ALUMNI')
  alumniRegisterEvent(
    @CurrentUser() user: AuthUser,
    @Param('eventId') eventId: string,
    @Body() body?: { paymentRef?: string; successUrl?: string; cancelUrl?: string },
  ) {
    return this.portalAlumni.registerForEvent(user, eventId, body);
  }

  @Get('alumni/jobs')
  @Roles('ALUMNI')
  alumniJobs(@CurrentUser() user: AuthUser) {
    return this.portalAlumni.listJobs(user);
  }
}
