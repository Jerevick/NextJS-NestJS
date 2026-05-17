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
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequireAnyPermissions } from '../common/decorators/require-any-permissions.decorator';
import { AnyPermissionsGuard } from '../common/guards/any-permissions.guard';
import type { CreateCarryoverEnrollmentDto } from './dto/create-carryover-enrollment.dto';
import type { CreateProgressionDecisionDto } from './dto/create-progression-decision.dto';
import type { CreateProgressionRuleDto } from './dto/create-progression-rule.dto';
import type { EvaluateProgressionBatchDto } from './dto/evaluate-progression-batch.dto';
import type { RegisterResitDto } from './dto/register-resit.dto';
import type { UpsertAcademicSessionDto } from './dto/upsert-academic-session.dto';
import type { ListProgressionRulesQueryDto } from './dto/list-progression-rules-query.dto';
import type { ProgressionHoldBodyDto } from './dto/progression-hold-body.dto';
import type { UpdateProgressionRuleDto } from './dto/update-progression-rule.dto';
import { ProgressionService } from './progression.service';

@ApiTags('sis-progression')
@ApiBearerAuth('JWT')
@Throttle({ default: { limit: 120, ttl: 60_000 } })
@Controller('sis/progression')
export class ProgressionController {
  constructor(private readonly progression: ProgressionService) {}

  @Get('rules')
  @ApiOperation({ summary: 'List progression rules (institution or programme scope)' })
  @UseGuards(AnyPermissionsGuard)
  @RequireAnyPermissions('progression.read', 'students.read', 'students.write')
  listRules(@CurrentUser() user: AuthUser, @Query() query: ListProgressionRulesQueryDto) {
    return this.progression.listRules(user, query);
  }

  @Post('rules')
  @ApiOperation({ summary: 'Create a progression rule' })
  @UseGuards(AnyPermissionsGuard)
  @RequireAnyPermissions('progression.write', 'students.write')
  createRule(@CurrentUser() user: AuthUser, @Body() dto: CreateProgressionRuleDto) {
    return this.progression.createRule(user, dto);
  }

  @Patch('rules/:ruleId')
  @ApiOperation({ summary: 'Update a progression rule (soft fields)' })
  @ApiParam({ name: 'ruleId', description: 'Progression rule id' })
  @UseGuards(AnyPermissionsGuard)
  @RequireAnyPermissions('progression.write', 'students.write')
  patchRule(
    @CurrentUser() user: AuthUser,
    @Param('ruleId') ruleId: string,
    @Body() dto: UpdateProgressionRuleDto,
  ) {
    return this.progression.updateRule(user, ruleId, dto);
  }

  @Delete('rules/:ruleId')
  @ApiOperation({ summary: 'Soft-delete a progression rule' })
  @ApiParam({ name: 'ruleId', description: 'Progression rule id' })
  @UseGuards(AnyPermissionsGuard)
  @RequireAnyPermissions('progression.write', 'students.write')
  removeRule(@CurrentUser() user: AuthUser, @Param('ruleId') ruleId: string) {
    return this.progression.removeRule(user, ruleId);
  }

  @Post('evaluate-batch')
  @ApiOperation({
    summary: 'Batch-evaluate progression for active students in a semester',
    description:
      'Optional automatic PROMOTION/AUTOMATIC decisions and optional initiation of ACADEMIC_PROGRESSION_* workflows when initiateReviewWorkflows is true.',
  })
  @UseGuards(AnyPermissionsGuard)
  @RequireAnyPermissions('progression.write', 'students.write')
  evaluateBatch(@CurrentUser() user: AuthUser, @Body() dto: EvaluateProgressionBatchDto) {
    return this.progression.evaluateBatch(user, dto);
  }

  @Post('decisions')
  @ApiOperation({ summary: 'Append a progression decision (immutable ledger)' })
  @UseGuards(AnyPermissionsGuard)
  @RequireAnyPermissions('progression.write', 'students.write')
  createDecision(@CurrentUser() user: AuthUser, @Body() dto: CreateProgressionDecisionDto) {
    return this.progression.createDecision(user, dto);
  }

  @Patch('holds/:holdId/clear')
  @ApiOperation({ summary: 'Clear a student progression hold' })
  @ApiParam({ name: 'holdId', description: 'Hold record id' })
  @UseGuards(AnyPermissionsGuard)
  @RequireAnyPermissions('progression.write', 'students.write')
  clearHold(@CurrentUser() user: AuthUser, @Param('holdId') holdId: string) {
    return this.progression.clearHold(user, holdId);
  }

  @Get('students/:studentId/decisions')
  @ApiOperation({ summary: 'List progression decisions for a student' })
  @ApiParam({ name: 'studentId', description: 'Student id' })
  @UseGuards(AnyPermissionsGuard)
  @RequireAnyPermissions('progression.read', 'students.read', 'students.write')
  listDecisions(@CurrentUser() user: AuthUser, @Param('studentId') studentId: string) {
    return this.progression.listDecisions(user, studentId);
  }

  @Get('students/:studentId/holds')
  @ApiOperation({ summary: 'List active progression holds for a student' })
  @ApiParam({ name: 'studentId', description: 'Student id' })
  @UseGuards(AnyPermissionsGuard)
  @RequireAnyPermissions('progression.read', 'students.read', 'students.write')
  listHolds(@CurrentUser() user: AuthUser, @Param('studentId') studentId: string) {
    return this.progression.listActiveHolds(user, studentId);
  }

  @Post('students/:studentId/holds')
  @ApiOperation({ summary: 'Place a progression hold on a student' })
  @ApiParam({ name: 'studentId', description: 'Student id' })
  @UseGuards(AnyPermissionsGuard)
  @RequireAnyPermissions('progression.write', 'students.write')
  createHold(
    @CurrentUser() user: AuthUser,
    @Param('studentId') studentId: string,
    @Body() dto: ProgressionHoldBodyDto,
  ) {
    return this.progression.createHold(user, studentId, {
      type: dto.type,
      reason: dto.reason ?? null,
      semesterId: dto.semesterId ?? null,
    });
  }

  @Get('students/:studentId/gpa')
  @ApiOperation({
    summary: 'GPA breakdown for a student using effective progression repeat policy',
  })
  @ApiParam({ name: 'studentId', description: 'Student id' })
  @UseGuards(AnyPermissionsGuard)
  @RequireAnyPermissions('progression.read', 'students.read', 'students.write')
  getStudentGpa(@CurrentUser() user: AuthUser, @Param('studentId') studentId: string) {
    return this.progression.getStudentGpaBreakdown(user, studentId);
  }

  @Get('students/:studentId/carryovers')
  @ApiOperation({ summary: 'List carryover enrollment links for a student' })
  @ApiParam({ name: 'studentId', description: 'Student id' })
  @UseGuards(AnyPermissionsGuard)
  @RequireAnyPermissions('progression.read', 'students.read', 'students.write')
  listCarryovers(@CurrentUser() user: AuthUser, @Param('studentId') studentId: string) {
    return this.progression.listCarryoversForStudent(user, studentId);
  }

  @Post('carryovers')
  @ApiOperation({ summary: 'Register a carryover link between failed and repeat enrollments' })
  @UseGuards(AnyPermissionsGuard)
  @RequireAnyPermissions('progression.write', 'students.write')
  createCarryover(@CurrentUser() user: AuthUser, @Body() dto: CreateCarryoverEnrollmentDto) {
    return this.progression.createCarryoverLink(user, dto);
  }

  @Post('resits')
  @ApiOperation({
    summary: 'Register a resit against an enrollment (grade cap enforced on grade write)',
  })
  @UseGuards(AnyPermissionsGuard)
  @RequireAnyPermissions('progression.write', 'students.write')
  registerResit(@CurrentUser() user: AuthUser, @Body() dto: RegisterResitDto) {
    return this.progression.registerResit(user, dto);
  }

  @Post('academic-sessions')
  @ApiOperation({
    summary: 'Upsert student academic session record (level / attempt / repeat reason)',
  })
  @UseGuards(AnyPermissionsGuard)
  @RequireAnyPermissions('progression.write', 'students.write')
  upsertSession(@CurrentUser() user: AuthUser, @Body() dto: UpsertAcademicSessionDto) {
    return this.progression.upsertAcademicSession(user, dto);
  }
}
