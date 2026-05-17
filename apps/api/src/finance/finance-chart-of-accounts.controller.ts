import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequireFinanceDirector } from '../common/decorators/require-finance-director.decorator';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { FinanceDirectorGuard } from './guards/finance-director.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { UpsertFinanceGlAccountDto } from './dto/upsert-finance-gl-account.dto';
import { FinanceGlService } from './finance-gl.service';

@Throttle({ default: { limit: 120, ttl: 60_000 } })
@Controller('finance')
@UseGuards(PermissionsGuard)
export class FinanceChartOfAccountsController {
  constructor(private readonly gl: FinanceGlService) {}

  @Get('chart-of-accounts')
  @RequirePermissions('finance.read')
  list(@CurrentUser() user: AuthUser, @Query('includeInactive') includeInactive?: string) {
    return this.gl.listAccounts(user.institutionId, {
      includeInactive: includeInactive === 'true' || includeInactive === '1',
    });
  }

  @Post('chart-of-accounts')
  @UseGuards(FinanceDirectorGuard)
  @RequirePermissions('finance.write')
  @RequireFinanceDirector()
  upsert(@CurrentUser() user: AuthUser, @Body() dto: UpsertFinanceGlAccountDto) {
    return this.gl.upsertAccount(user.institutionId, dto);
  }

  @Patch('chart-of-accounts/:accountId/active')
  @UseGuards(FinanceDirectorGuard)
  @RequirePermissions('finance.write')
  @RequireFinanceDirector()
  setActive(
    @CurrentUser() user: AuthUser,
    @Param('accountId') accountId: string,
    @Body() body: { isActive: boolean },
  ) {
    return this.gl.setAccountActive(user.institutionId, accountId, body.isActive === true);
  }

  @Get('gl/trial-balance')
  @RequirePermissions('finance.read')
  trialBalance(
    @CurrentUser() user: AuthUser,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.gl.trialBalance(
      user.institutionId,
      from ? new Date(from) : undefined,
      to ? new Date(to) : undefined,
    );
  }

  @Get('students/:studentId/transactions/:transactionId/gl')
  @RequirePermissions('finance.read')
  transactionJournal(@CurrentUser() user: AuthUser, @Param('transactionId') transactionId: string) {
    return this.gl.getJournalForTransaction(user.institutionId, transactionId);
  }
}
