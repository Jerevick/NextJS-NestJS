import { Body, Controller, Get, Param, Post, UseGuards, UseInterceptors } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RegisterScormPackageDto } from './dto/register-scorm-package.dto';
import { ScormCommitDto } from './dto/scorm-commit.dto';
import { LmsScormService } from './lms-scorm.service';
import { LmsStudentAccessInterceptor } from './lms-student-access.interceptor';

@Throttle({ default: { limit: 120, ttl: 60_000 } })
@Controller('lms/scorm')
@UseGuards(PermissionsGuard)
@UseInterceptors(LmsStudentAccessInterceptor)
export class LmsScormController {
  constructor(private readonly scorm: LmsScormService) {}

  @Post('lessons/:lessonId/register')
  @RequirePermissions('lms.write')
  registerPackage(
    @CurrentUser() actor: AuthUser,
    @Param('lessonId') lessonId: string,
    @Body() dto: RegisterScormPackageDto,
  ) {
    return this.scorm.registerPackage(actor, lessonId, dto);
  }

  @Get('launch/:lessonId')
  @RequirePermissions('lms.read')
  launch(@CurrentUser() actor: AuthUser, @Param('lessonId') lessonId: string) {
    return this.scorm.getLaunch(actor, lessonId);
  }

  @Post('lessons/:lessonId/commit')
  @RequirePermissions('lms.read')
  commit(
    @CurrentUser() actor: AuthUser,
    @Param('lessonId') lessonId: string,
    @Body() dto: ScormCommitDto,
  ) {
    return this.scorm.commitProgress(actor, lessonId, dto);
  }
}
