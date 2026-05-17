import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequireFinanceDirector } from '../common/decorators/require-finance-director.decorator';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { FinanceScholarshipFormsAdminService } from './finance-scholarship-forms-admin.service';
import { FinanceDirectorGuard } from './guards/finance-director.guard';

@Throttle({ default: { limit: 60, ttl: 60_000 } })
@Controller('finance/scholarship-forms')
@UseGuards(PermissionsGuard, FinanceDirectorGuard)
export class FinanceScholarshipFormsController {
  constructor(private readonly forms: FinanceScholarshipFormsAdminService) {}

  @Get()
  @RequirePermissions('finance.read')
  list(@CurrentUser() user: AuthUser) {
    return this.forms.listForms(user);
  }

  @Post()
  @RequirePermissions('finance.write')
  @RequireFinanceDirector()
  create(@CurrentUser() user: AuthUser, @Body() body: { schema: Record<string, unknown> }) {
    return this.forms.createForm(user, body.schema ?? {});
  }
}
