import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequireAnyPermissions } from '../common/decorators/require-any-permissions.decorator';
import { AnyPermissionsGuard } from '../common/guards/any-permissions.guard';
import { ProcessWorkflowStepDto } from './dto/process-workflow-step.dto';
import { WorkflowEngineService } from './workflow-engine.service';

@ApiTags('workflow')
@Controller('workflow')
export class WorkflowEngineController {
  constructor(private readonly engine: WorkflowEngineService) {}

  @Get('inbox')
  @UseGuards(AnyPermissionsGuard)
  @RequireAnyPermissions('workflow.read', 'workflow.act', 'students.reactivate', 'backfill.approve')
  @ApiOperation({ summary: 'Pending workflow actions for current user' })
  inbox(
    @CurrentUser() user: AuthUser,
    @Query('limit') limit?: string,
    @Query('codes') codes?: string,
  ) {
    const n = limit ? Number.parseInt(limit, 10) : 20;
    const definitionCodes = codes
      ?.split(',')
      .map((c) => c.trim())
      .filter(Boolean);
    return this.engine.getInbox(user, Number.isNaN(n) ? 20 : n, definitionCodes);
  }

  @Get('initiated')
  @UseGuards(AnyPermissionsGuard)
  @RequireAnyPermissions('workflow.read', 'workflow.act')
  initiated(@CurrentUser() user: AuthUser, @Query('limit') limit?: string) {
    const n = limit ? Number.parseInt(limit, 10) : 20;
    return this.engine.getInitiated(user, Number.isNaN(n) ? 20 : n);
  }

  @Get('instances/:id')
  @UseGuards(AnyPermissionsGuard)
  @RequireAnyPermissions('workflow.read', 'workflow.act')
  getById(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.engine.getById(user, id);
  }

  @Post('instances/:id/act')
  @UseGuards(AnyPermissionsGuard)
  @RequireAnyPermissions('workflow.act', 'students.reactivate', 'backfill.approve')
  @ApiOperation({ summary: 'Approve, reject, escalate, or request info on current step' })
  act(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: ProcessWorkflowStepDto) {
    return this.engine.processStep(user, {
      instanceId: id,
      actorId: user.userId,
      action: dto.action,
      notes: dto.notes,
      additionalData: dto.additionalData,
    });
  }
}
