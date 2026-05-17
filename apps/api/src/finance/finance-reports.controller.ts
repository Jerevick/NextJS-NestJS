import { Controller, Get, Header, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { Throttle } from '@nestjs/throttler';
import type { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { FinanceService } from './finance.service';

@Throttle({ default: { limit: 60, ttl: 60_000 } })
@Controller('finance/reports')
@UseGuards(PermissionsGuard)
export class FinanceReportsController {
  constructor(private readonly finance: FinanceService) {}

  @Get('outstanding')
  @RequirePermissions('finance.read')
  outstanding(@CurrentUser() user: AuthUser, @Query('departmentId') departmentId?: string) {
    return this.finance.outstandingBalancesReport(user, { departmentId });
  }

  @Get('aging')
  @RequirePermissions('finance.read')
  aging(@CurrentUser() user: AuthUser, @Query('departmentId') departmentId?: string) {
    return this.finance.agingReport(user, { departmentId });
  }

  @Get('revenue')
  @RequirePermissions('finance.read')
  revenue(
    @CurrentUser() user: AuthUser,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('programmeId') programmeId?: string,
    @Query('departmentId') departmentId?: string,
  ) {
    return this.finance.revenueReport(user, from, to, { programmeId, departmentId });
  }

  @Get('revenue/export.xlsx')
  @RequirePermissions('finance.read')
  @Header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  @Header('Content-Disposition', 'attachment; filename="revenue-report.xlsx"')
  async exportRevenueExcel(
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('programmeId') programmeId?: string,
    @Query('departmentId') departmentId?: string,
  ) {
    const buffer = await this.finance.exportRevenueExcel(user, from, to, {
      programmeId,
      departmentId,
    });
    res.send(buffer);
  }

  @Get('revenue/export.pdf')
  @RequirePermissions('finance.read')
  async exportRevenuePdf(
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('programmeId') programmeId?: string,
    @Query('departmentId') departmentId?: string,
  ) {
    const buffer = await this.finance.exportRevenuePdf(user, from, to, {
      programmeId,
      departmentId,
    });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="revenue-report.pdf"');
    res.send(buffer);
  }

  @Get('outstanding/export.csv')
  @RequirePermissions('finance.read')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="outstanding-balances.csv"')
  exportOutstanding(@CurrentUser() user: AuthUser, @Query('departmentId') departmentId?: string) {
    return this.finance.exportOutstandingCsv(user, { departmentId });
  }
}
