import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequireFinanceDirector } from '../common/decorators/require-finance-director.decorator';
import { FinanceBankIntegrationsService } from './finance-bank-integrations.service';
import { UpsertFinanceBankIntegrationDto } from './dto/upsert-finance-bank-integration.dto';
import { FinanceDirectorGuard } from './guards/finance-director.guard';

@Throttle({ default: { limit: 60, ttl: 60_000 } })
@Controller('finance/bank-integrations')
@UseGuards(PermissionsGuard, FinanceDirectorGuard)
export class FinanceBankIntegrationsController {
  constructor(private readonly bank: FinanceBankIntegrationsService) {}

  @Get()
  @RequirePermissions('finance.read')
  list(@CurrentUser() user: AuthUser) {
    return this.bank.list(user);
  }

  @Post()
  @RequirePermissions('finance.write')
  @RequireFinanceDirector()
  upsert(@CurrentUser() user: AuthUser, @Body() dto: UpsertFinanceBankIntegrationDto) {
    return this.bank.upsert(user, dto);
  }
}
