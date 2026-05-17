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
  UseInterceptors,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { CloneLmsCourseInstanceDto } from './dto/clone-lms-course-instance.dto';
import { CreateLmsContentModuleDto } from './dto/create-lms-content-module.dto';
import { CreateLmsCourseInstanceDto } from './dto/create-lms-course-instance.dto';
import { CreateLmsLessonDto } from './dto/create-lms-lesson.dto';
import { CreateLmsLessonResourceDto } from './dto/create-lms-lesson-resource.dto';
import { ListLmsCourseInstancesQueryDto } from './dto/list-lms-course-instances-query.dto';
import { ReorderLmsLessonsDto } from './dto/reorder-lms-lessons.dto';
import { ReorderLmsModulesDto } from './dto/reorder-lms-modules.dto';
import { UpdateLmsContentModuleDto } from './dto/update-lms-content-module.dto';
import { UpdateLmsCourseInstanceDto } from './dto/update-lms-course-instance.dto';
import { UpdateLmsLessonDto } from './dto/update-lms-lesson.dto';
import { UpdateLmsLessonResourceDto } from './dto/update-lms-lesson-resource.dto';
import { LmsStudentAccessInterceptor } from './lms-student-access.interceptor';
import { LmsService } from './lms.service';

@Throttle({ default: { limit: 120, ttl: 60_000 } })
@Controller('lms')
@UseGuards(PermissionsGuard)
@UseInterceptors(LmsStudentAccessInterceptor)
export class LmsController {
  constructor(private readonly lms: LmsService) {}

  @Get('course-instances/:courseInstanceId/modules')
  @RequirePermissions('lms.read')
  listModules(@CurrentUser() user: AuthUser, @Param('courseInstanceId') courseInstanceId: string) {
    return this.lms.listModules(user, courseInstanceId);
  }

  @Post('course-instances/:courseInstanceId/modules')
  @RequirePermissions('lms.write')
  createModule(
    @CurrentUser() user: AuthUser,
    @Param('courseInstanceId') courseInstanceId: string,
    @Body() dto: CreateLmsContentModuleDto,
  ) {
    return this.lms.createModule(user, courseInstanceId, dto);
  }

  @Post('course-instances/:courseInstanceId/modules/reorder')
  @RequirePermissions('lms.write')
  reorderModules(
    @CurrentUser() user: AuthUser,
    @Param('courseInstanceId') courseInstanceId: string,
    @Body() dto: ReorderLmsModulesDto,
  ) {
    return this.lms.reorderModules(user, courseInstanceId, dto);
  }

  @Get('modules/:moduleId/lessons')
  @RequirePermissions('lms.read')
  listLessons(@CurrentUser() user: AuthUser, @Param('moduleId') moduleId: string) {
    return this.lms.listLessons(user, moduleId);
  }

  @Post('modules/:moduleId/lessons')
  @RequirePermissions('lms.write')
  createLesson(
    @CurrentUser() user: AuthUser,
    @Param('moduleId') moduleId: string,
    @Body() dto: CreateLmsLessonDto,
  ) {
    return this.lms.createLesson(user, moduleId, dto);
  }

  @Post('modules/:moduleId/lessons/reorder')
  @RequirePermissions('lms.write')
  reorderLessons(
    @CurrentUser() user: AuthUser,
    @Param('moduleId') moduleId: string,
    @Body() dto: ReorderLmsLessonsDto,
  ) {
    return this.lms.reorderLessons(user, moduleId, dto);
  }

  @Patch('modules/:moduleId')
  @RequirePermissions('lms.write')
  updateModule(
    @CurrentUser() user: AuthUser,
    @Param('moduleId') moduleId: string,
    @Body() dto: UpdateLmsContentModuleDto,
  ) {
    return this.lms.updateModule(user, moduleId, dto);
  }

  @Delete('modules/:moduleId')
  @RequirePermissions('lms.write')
  removeModule(@CurrentUser() user: AuthUser, @Param('moduleId') moduleId: string) {
    return this.lms.removeModule(user, moduleId);
  }

  @Get('lessons/:lessonId/resources')
  @RequirePermissions('lms.read')
  listLessonResources(@CurrentUser() user: AuthUser, @Param('lessonId') lessonId: string) {
    return this.lms.listLessonResources(user, lessonId);
  }

  @Get('lessons/:lessonId')
  @RequirePermissions('lms.read')
  getLesson(@CurrentUser() user: AuthUser, @Param('lessonId') lessonId: string) {
    return this.lms.getLesson(user, lessonId);
  }

  @Post('lessons/:lessonId/resources')
  @RequirePermissions('lms.write')
  createLessonResource(
    @CurrentUser() user: AuthUser,
    @Param('lessonId') lessonId: string,
    @Body() dto: CreateLmsLessonResourceDto,
  ) {
    return this.lms.createLessonResource(user, lessonId, dto);
  }

  @Patch('lesson-resources/:resourceId')
  @RequirePermissions('lms.write')
  updateLessonResource(
    @CurrentUser() user: AuthUser,
    @Param('resourceId') resourceId: string,
    @Body() dto: UpdateLmsLessonResourceDto,
  ) {
    return this.lms.updateLessonResource(user, resourceId, dto);
  }

  @Delete('lesson-resources/:resourceId')
  @RequirePermissions('lms.write')
  removeLessonResource(@CurrentUser() user: AuthUser, @Param('resourceId') resourceId: string) {
    return this.lms.removeLessonResource(user, resourceId);
  }

  @Patch('lessons/:lessonId')
  @RequirePermissions('lms.write')
  updateLesson(
    @CurrentUser() user: AuthUser,
    @Param('lessonId') lessonId: string,
    @Body() dto: UpdateLmsLessonDto,
  ) {
    return this.lms.updateLesson(user, lessonId, dto);
  }

  @Delete('lessons/:lessonId')
  @RequirePermissions('lms.write')
  removeLesson(@CurrentUser() user: AuthUser, @Param('lessonId') lessonId: string) {
    return this.lms.removeLesson(user, lessonId);
  }

  @Get('course-instances')
  @RequirePermissions('lms.read')
  listCourseInstances(
    @CurrentUser() user: AuthUser,
    @Query() query: ListLmsCourseInstancesQueryDto,
  ) {
    return this.lms.listCourseInstances(user, query);
  }

  @Post('course-instances')
  @RequirePermissions('lms.write')
  createCourseInstance(@CurrentUser() user: AuthUser, @Body() dto: CreateLmsCourseInstanceDto) {
    return this.lms.createCourseInstance(user, dto);
  }

  @Get('course-instances/:id')
  @RequirePermissions('lms.read')
  getCourseInstance(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.lms.getCourseInstance(user, id);
  }

  @Post('course-instances/:id/student/ping')
  @RequirePermissions('lms.read')
  pingStudentCourse(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.lms.pingStudentCourseAccess(user, id);
  }

  @Post('course-instances/:id/clone')
  @RequirePermissions('lms.write')
  cloneCourseInstance(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: CloneLmsCourseInstanceDto,
  ) {
    return this.lms.cloneCourseInstance(user, id, dto);
  }

  @Patch('course-instances/:id')
  @RequirePermissions('lms.write')
  updateCourseInstance(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateLmsCourseInstanceDto,
  ) {
    return this.lms.updateCourseInstance(user, id, dto);
  }

  @Delete('course-instances/:id')
  @RequirePermissions('lms.write')
  removeCourseInstance(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.lms.removeCourseInstance(user, id);
  }
}
