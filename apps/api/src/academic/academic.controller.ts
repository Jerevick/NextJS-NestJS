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
import { RequireAnyPermissions } from '../common/decorators/require-any-permissions.decorator';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { AnyPermissionsGuard } from '../common/guards/any-permissions.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { AcademicService } from './academic.service';
import type {
  CreateAcademicYearDto,
  CreateCourseDto,
  CreateDepartmentDto,
  CreateDivisionDto,
  CreateProgramDto,
  CreateSectionDto,
  CreateSemesterDto,
  CreateTimetableDto,
  ListAcademicQueryDto,
  ListSectionsQueryDto,
  UpdateAcademicYearDto,
  UpdateCourseDto,
  UpdateDepartmentDto,
  UpdateDivisionDto,
  UpdateProgramDto,
  UpdateSectionDto,
  UpdateSemesterDto,
  UpdateTimetableDto,
} from './dto/academic.dto';

@Controller('academic')
export class AcademicController {
  constructor(private readonly academic: AcademicService) {}

  // --- Years ---
  @Get('years')
  @UseGuards(AnyPermissionsGuard)
  @RequireAnyPermissions('academic.read', 'academic.write')
  listYears(@CurrentUser() user: AuthUser, @Query() query: ListAcademicQueryDto) {
    return this.academic.listYears(user, query);
  }

  @Post('years')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('academic.write')
  createYear(@CurrentUser() user: AuthUser, @Body() dto: CreateAcademicYearDto) {
    return this.academic.createYear(user, dto);
  }

  @Get('years/:yearId/semesters')
  @UseGuards(AnyPermissionsGuard)
  @RequireAnyPermissions('academic.read', 'academic.write')
  listSemestersForYear(@CurrentUser() user: AuthUser, @Param('yearId') yearId: string) {
    return this.academic.listSemestersForYear(user, yearId);
  }

  @Post('years/:yearId/semesters')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('academic.write')
  createSemester(
    @CurrentUser() user: AuthUser,
    @Param('yearId') yearId: string,
    @Body() dto: CreateSemesterDto,
  ) {
    return this.academic.createSemester(user, yearId, dto);
  }

  @Get('years/:yearId')
  @UseGuards(AnyPermissionsGuard)
  @RequireAnyPermissions('academic.read', 'academic.write')
  getYear(@CurrentUser() user: AuthUser, @Param('yearId') yearId: string) {
    return this.academic.getYear(user, yearId);
  }

  @Patch('years/:yearId')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('academic.write')
  updateYear(
    @CurrentUser() user: AuthUser,
    @Param('yearId') yearId: string,
    @Body() dto: UpdateAcademicYearDto,
  ) {
    return this.academic.updateYear(user, yearId, dto);
  }

  @Delete('years/:yearId')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('academic.write')
  removeYear(@CurrentUser() user: AuthUser, @Param('yearId') yearId: string) {
    return this.academic.removeYear(user, yearId);
  }

  // --- Semesters (by id) + timetables + sections ---
  @Get('semesters/:semesterId/timetables')
  @UseGuards(AnyPermissionsGuard)
  @RequireAnyPermissions('academic.read', 'academic.write')
  listTimetables(@CurrentUser() user: AuthUser, @Param('semesterId') semesterId: string) {
    return this.academic.listTimetables(user, semesterId);
  }

  @Post('semesters/:semesterId/timetables')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('academic.write')
  createTimetable(
    @CurrentUser() user: AuthUser,
    @Param('semesterId') semesterId: string,
    @Body() dto: CreateTimetableDto,
  ) {
    return this.academic.createTimetable(user, semesterId, dto);
  }

  @Get('semesters/:semesterId/sections')
  @UseGuards(AnyPermissionsGuard)
  @RequireAnyPermissions(
    'academic.read',
    'academic.write',
    'enrollments.read',
    'enrollments.write',
    'students.read',
    'students.write',
  )
  listSections(
    @CurrentUser() user: AuthUser,
    @Param('semesterId') semesterId: string,
    @Query() query: ListSectionsQueryDto,
  ) {
    return this.academic.listSections(user, semesterId, query);
  }

  @Get('semesters/:semesterId')
  @UseGuards(AnyPermissionsGuard)
  @RequireAnyPermissions('academic.read', 'academic.write')
  getSemester(@CurrentUser() user: AuthUser, @Param('semesterId') semesterId: string) {
    return this.academic.getSemester(user, semesterId);
  }

  @Patch('semesters/:semesterId')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('academic.write')
  updateSemester(
    @CurrentUser() user: AuthUser,
    @Param('semesterId') semesterId: string,
    @Body() dto: UpdateSemesterDto,
  ) {
    return this.academic.updateSemester(user, semesterId, dto);
  }

  @Delete('semesters/:semesterId')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('academic.write')
  removeSemester(@CurrentUser() user: AuthUser, @Param('semesterId') semesterId: string) {
    return this.academic.removeSemester(user, semesterId);
  }

  @Get('timetables/:timetableId')
  @UseGuards(AnyPermissionsGuard)
  @RequireAnyPermissions('academic.read', 'academic.write')
  getTimetable(@CurrentUser() user: AuthUser, @Param('timetableId') timetableId: string) {
    return this.academic.getTimetable(user, timetableId);
  }

  @Patch('timetables/:timetableId')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('academic.write')
  updateTimetable(
    @CurrentUser() user: AuthUser,
    @Param('timetableId') timetableId: string,
    @Body() dto: UpdateTimetableDto,
  ) {
    return this.academic.updateTimetable(user, timetableId, dto);
  }

  @Delete('timetables/:timetableId')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('academic.write')
  removeTimetable(@CurrentUser() user: AuthUser, @Param('timetableId') timetableId: string) {
    return this.academic.removeTimetable(user, timetableId);
  }

  // --- Divisions ---
  @Get('divisions')
  @UseGuards(AnyPermissionsGuard)
  @RequireAnyPermissions('academic.read', 'academic.write')
  listDivisions(@CurrentUser() user: AuthUser, @Query() query: ListAcademicQueryDto) {
    return this.academic.listDivisions(user, query);
  }

  @Post('divisions')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('academic.write')
  createDivision(@CurrentUser() user: AuthUser, @Body() dto: CreateDivisionDto) {
    return this.academic.createDivision(user, dto);
  }

  @Get('divisions/:divisionId/departments')
  @UseGuards(AnyPermissionsGuard)
  @RequireAnyPermissions('academic.read', 'academic.write')
  listDepartments(@CurrentUser() user: AuthUser, @Param('divisionId') divisionId: string) {
    return this.academic.listDepartments(user, divisionId);
  }

  @Post('divisions/:divisionId/departments')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('academic.write')
  createDepartment(
    @CurrentUser() user: AuthUser,
    @Param('divisionId') divisionId: string,
    @Body() dto: CreateDepartmentDto,
  ) {
    return this.academic.createDepartment(user, divisionId, dto);
  }

  @Get('divisions/:divisionId')
  @UseGuards(AnyPermissionsGuard)
  @RequireAnyPermissions('academic.read', 'academic.write')
  getDivision(@CurrentUser() user: AuthUser, @Param('divisionId') divisionId: string) {
    return this.academic.getDivision(user, divisionId);
  }

  @Patch('divisions/:divisionId')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('academic.write')
  updateDivision(
    @CurrentUser() user: AuthUser,
    @Param('divisionId') divisionId: string,
    @Body() dto: UpdateDivisionDto,
  ) {
    return this.academic.updateDivision(user, divisionId, dto);
  }

  @Delete('divisions/:divisionId')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('academic.write')
  removeDivision(@CurrentUser() user: AuthUser, @Param('divisionId') divisionId: string) {
    return this.academic.removeDivision(user, divisionId);
  }

  // --- Departments ---
  @Get('departments/:departmentId/programs')
  @UseGuards(AnyPermissionsGuard)
  @RequireAnyPermissions('academic.read', 'academic.write')
  listPrograms(@CurrentUser() user: AuthUser, @Param('departmentId') departmentId: string) {
    return this.academic.listPrograms(user, departmentId);
  }

  @Post('departments/:departmentId/programs')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('academic.write')
  createProgram(
    @CurrentUser() user: AuthUser,
    @Param('departmentId') departmentId: string,
    @Body() dto: CreateProgramDto,
  ) {
    return this.academic.createProgram(user, departmentId, dto);
  }

  @Get('departments/:departmentId/courses')
  @UseGuards(AnyPermissionsGuard)
  @RequireAnyPermissions('academic.read', 'academic.write')
  listCourses(@CurrentUser() user: AuthUser, @Param('departmentId') departmentId: string) {
    return this.academic.listCourses(user, departmentId);
  }

  @Post('departments/:departmentId/courses')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('academic.write')
  createCourse(
    @CurrentUser() user: AuthUser,
    @Param('departmentId') departmentId: string,
    @Body() dto: CreateCourseDto,
  ) {
    return this.academic.createCourse(user, departmentId, dto);
  }

  @Get('departments/:departmentId')
  @UseGuards(AnyPermissionsGuard)
  @RequireAnyPermissions('academic.read', 'academic.write')
  getDepartment(@CurrentUser() user: AuthUser, @Param('departmentId') departmentId: string) {
    return this.academic.getDepartment(user, departmentId);
  }

  @Patch('departments/:departmentId')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('academic.write')
  updateDepartment(
    @CurrentUser() user: AuthUser,
    @Param('departmentId') departmentId: string,
    @Body() dto: UpdateDepartmentDto,
  ) {
    return this.academic.updateDepartment(user, departmentId, dto);
  }

  @Delete('departments/:departmentId')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('academic.write')
  removeDepartment(@CurrentUser() user: AuthUser, @Param('departmentId') departmentId: string) {
    return this.academic.removeDepartment(user, departmentId);
  }

  /** Flat program list for registrar flows (student roster filters, new student). */
  @Get('catalog/programs')
  @UseGuards(AnyPermissionsGuard)
  @RequireAnyPermissions(
    'students.read',
    'students.write',
    'academic.read',
    'academic.write',
    'finance.read',
    'finance.write',
  )
  listProgramsCatalog(@CurrentUser() user: AuthUser) {
    return this.academic.listProgramsForInstitution(user);
  }

  @Get('catalog/semesters')
  @UseGuards(AnyPermissionsGuard)
  @RequireAnyPermissions(
    'students.read',
    'students.write',
    'enrollments.read',
    'enrollments.write',
    'academic.read',
    'academic.write',
  )
  listSemestersCatalog(@CurrentUser() user: AuthUser) {
    return this.academic.listSemestersForInstitution(user);
  }

  // --- Programs & courses ---
  @Get('programs/:programId')
  @UseGuards(AnyPermissionsGuard)
  @RequireAnyPermissions('academic.read', 'academic.write')
  getProgram(@CurrentUser() user: AuthUser, @Param('programId') programId: string) {
    return this.academic.getProgram(user, programId);
  }

  @Patch('programs/:programId')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('academic.write')
  updateProgram(
    @CurrentUser() user: AuthUser,
    @Param('programId') programId: string,
    @Body() dto: UpdateProgramDto,
  ) {
    return this.academic.updateProgram(user, programId, dto);
  }

  @Delete('programs/:programId')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('academic.write')
  removeProgram(@CurrentUser() user: AuthUser, @Param('programId') programId: string) {
    return this.academic.removeProgram(user, programId);
  }

  @Get('courses/:courseId')
  @UseGuards(AnyPermissionsGuard)
  @RequireAnyPermissions('academic.read', 'academic.write')
  getCourse(@CurrentUser() user: AuthUser, @Param('courseId') courseId: string) {
    return this.academic.getCourse(user, courseId);
  }

  @Patch('courses/:courseId')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('academic.write')
  updateCourse(
    @CurrentUser() user: AuthUser,
    @Param('courseId') courseId: string,
    @Body() dto: UpdateCourseDto,
  ) {
    return this.academic.updateCourse(user, courseId, dto);
  }

  @Delete('courses/:courseId')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('academic.write')
  removeCourse(@CurrentUser() user: AuthUser, @Param('courseId') courseId: string) {
    return this.academic.removeCourse(user, courseId);
  }

  // --- Sections ---
  @Post('sections')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('academic.write')
  createSection(@CurrentUser() user: AuthUser, @Body() dto: CreateSectionDto) {
    return this.academic.createSection(user, dto);
  }

  @Get('sections/:sectionId')
  @UseGuards(AnyPermissionsGuard)
  @RequireAnyPermissions('academic.read', 'academic.write')
  getSection(@CurrentUser() user: AuthUser, @Param('sectionId') sectionId: string) {
    return this.academic.getSection(user, sectionId);
  }

  @Patch('sections/:sectionId')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('academic.write')
  updateSection(
    @CurrentUser() user: AuthUser,
    @Param('sectionId') sectionId: string,
    @Body() dto: UpdateSectionDto,
  ) {
    return this.academic.updateSection(user, sectionId, dto);
  }

  @Delete('sections/:sectionId')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('academic.write')
  removeSection(@CurrentUser() user: AuthUser, @Param('sectionId') sectionId: string) {
    return this.academic.removeSection(user, sectionId);
  }
}
