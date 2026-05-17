import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequireFinanceDirector } from '../common/decorators/require-finance-director.decorator';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { FinanceDirectorGuard } from './guards/finance-director.guard';
import { CreateBulkChargeDto } from './dto/create-bulk-charge.dto';
import { FinanceBulkChargeService } from './finance-bulk-charge.service';

@Throttle({ default: { limit: 30, ttl: 60_000 } })
@Controller('finance/bulk-charges')
@UseGuards(PermissionsGuard, FinanceDirectorGuard)
export class FinanceBulkChargeController {
  constructor(private readonly bulk: FinanceBulkChargeService) {}

  @Post()
  @RequirePermissions('finance.write')
  @RequireFinanceDirector()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateBulkChargeDto) {
    return this.bulk.createJob(user, dto);
  }

  @Get(':jobId')
  @RequirePermissions('finance.read')
  get(@CurrentUser() user: AuthUser, @Param('jobId') jobId: string) {
    return this.bulk.getJob(user, jobId);
  }
}
