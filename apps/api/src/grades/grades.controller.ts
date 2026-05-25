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
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { ResourceEntityId } from '../common/decorators/resource-entity-id.decorator';
import { AnyPermissionsGuard } from '../common/guards/any-permissions.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { CreateGradeOverrideDto } from './dto/create-grade-override.dto';
import { CreateGradingScaleDto } from './dto/create-grading-scale.dto';
import { ListGradeOverridesQueryDto } from './dto/list-grade-overrides-query.dto';
import { UpdateEnrollmentGradeDto } from './dto/update-enrollment-grade.dto';
import { UpdateGradingScaleDto } from './dto/update-grading-scale.dto';
import { PatchGradeComponentWeightsDto } from './dto/patch-grade-component-weights.dto';
import { GradesService } from './grades.service';

@Controller('grades')
export class GradesController {
  constructor(private readonly grades: GradesService) {}

  @Get('override-requests')
  @UseGuards(AnyPermissionsGuard)
  @RequireAnyPermissions('grades.write', 'grades.approve_board', 'grades.amend_approved')
  listPendingOverrides(@CurrentUser() user: AuthUser, @Query() query: ListGradeOverridesQueryDto) {
    return this.grades.listPendingGradeOverrides(user, query);
  }

  @Post('override-requests/:id/approve')
  @UseGuards(AnyPermissionsGuard)
  @RequireAnyPermissions('grades.write', 'grades.approve_board', 'grades.amend_approved')
  @StudentRecordWrite({ mode: 'gradeOverrideIdParam', param: 'id', recordDate: { kind: 'now' } })
  approveOverride(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.grades.approveGradeOverride(user, id);
  }

  @Post('override-requests/:id/reject')
  @UseGuards(AnyPermissionsGuard)
  @RequireAnyPermissions('grades.write', 'grades.approve_board', 'grades.amend_approved')
  @StudentRecordWrite({ mode: 'gradeOverrideIdParam', param: 'id', recordDate: { kind: 'now' } })
  rejectOverride(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.grades.rejectGradeOverride(user, id);
  }

  @Post('enrollments/:enrollmentId/override-requests')
  @ResourceEntityId('enrollmentId', 'enrollment')
  @UseGuards(AnyPermissionsGuard)
  @RequireAnyPermissions('grades.write', 'grades.enter', 'grades.amend_approved')
  @StudentRecordWrite({
    mode: 'enrollmentIdParam',
    param: 'enrollmentId',
    recordDate: { kind: 'now' },
  })
  createOverrideRequest(
    @CurrentUser() user: AuthUser,
    @Param('enrollmentId') enrollmentId: string,
    @Body() dto: CreateGradeOverrideDto,
  ) {
    return this.grades.createGradeOverrideRequest(user, enrollmentId, dto);
  }

  @Get('governance/effective')
  @UseGuards(AnyPermissionsGuard)
  @RequireAnyPermissions('grades.read', 'grades.write', 'grades.enter')
  effectiveGovernance(@CurrentUser() user: AuthUser) {
    return this.grades.getEffectiveGradeGovernance(user);
  }

  @Patch('settings/component-weights')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('grades.write')
  patchGradeComponentWeights(
    @CurrentUser() user: AuthUser,
    @Body() dto: PatchGradeComponentWeightsDto,
  ) {
    return this.grades.patchGradeComponentWeights(user, dto);
  }

  @Get('scales')
  @UseGuards(AnyPermissionsGuard)
  @RequireAnyPermissions('grades.read', 'grades.write', 'grades.enter')
  listScales(@CurrentUser() user: AuthUser) {
    return this.grades.listGradingScales(user);
  }

  @Post('scales')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('grades.write')
  createScale(@CurrentUser() user: AuthUser, @Body() dto: CreateGradingScaleDto) {
    return this.grades.createGradingScale(user, dto);
  }

  @Patch('scales/:id')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('grades.write')
  updateScale(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateGradingScaleDto,
  ) {
    return this.grades.updateGradingScale(user, id, dto);
  }

  @Delete('scales/:id')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('grades.write')
  removeScale(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.grades.removeGradingScale(user, id);
  }

  @Get('sections/:sectionId/enrollments')
  @UseGuards(AnyPermissionsGuard)
  @RequireAnyPermissions('grades.read', 'grades.write', 'grades.enter')
  listSectionEnrollments(@CurrentUser() user: AuthUser, @Param('sectionId') sectionId: string) {
    return this.grades.listSectionEnrollments(user, sectionId);
  }

  @Patch('enrollments/:enrollmentId')
  @UseGuards(AnyPermissionsGuard)
  @RequireAnyPermissions('grades.write', 'grades.enter')
  @StudentRecordWrite({
    mode: 'enrollmentIdParam',
    param: 'enrollmentId',
    recordDate: { kind: 'now' },
  })
  updateEnrollmentGrade(
    @CurrentUser() user: AuthUser,
    @Param('enrollmentId') enrollmentId: string,
    @Body() dto: UpdateEnrollmentGradeDto,
  ) {
    return this.grades.updateEnrollmentGrade(user, enrollmentId, dto);
  }
}
