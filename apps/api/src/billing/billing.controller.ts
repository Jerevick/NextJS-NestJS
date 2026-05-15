import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import type { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequireAnyPermissions } from '../common/decorators/require-any-permissions.decorator';
import { AnyPermissionsGuard } from '../common/guards/any-permissions.guard';
import { BillingDisputeService } from './billing-dispute.service';
import { BillingService } from './billing.service';
import { FinalizeInvoiceDto } from './dto/finalize-invoice.dto';
import { GenerateDraftInvoiceDto } from './dto/generate-draft-invoice.dto';
import { InitiateBillingDisputeDto } from './dto/initiate-billing-dispute.dto';
import { ListBillingDisputesQueryDto } from './dto/list-billing-disputes-query.dto';
import { ListBillingQueryDto } from './dto/list-billing-query.dto';
import { ListMonthlySummariesQueryDto } from './dto/list-monthly-summaries-query.dto';
import { ListSnapshotsQueryDto } from './dto/list-snapshots-query.dto';
import { LockDailySnapshotsDto } from './dto/lock-daily-snapshots.dto';
import { MonthlyPeriodDto } from './dto/monthly-period.dto';
import { ResolveBillingDisputeDto } from './dto/resolve-billing-dispute.dto';
import { BillingImpactQueryDto } from './dto/billing-impact-query.dto';

@ApiTags('billing')
@ApiBearerAuth('JWT')
@Controller('billing')
export class BillingController {
  constructor(
    private readonly billing: BillingService,
    private readonly billingDisputes: BillingDisputeService,
  ) {}

  @Get('overview')
  @UseGuards(AnyPermissionsGuard)
  @RequireAnyPermissions(
    'billing.read',
    'billing.write',
    'institutions.read',
    'institutions.write',
  )
  getOverview(@CurrentUser() user: AuthUser) {
    return this.billing.getOverview(user);
  }

  @Get('impact-report')
  @UseGuards(AnyPermissionsGuard)
  @RequireAnyPermissions(
    'billing.read',
    'billing.write',
    'institutions.read',
    'institutions.write',
  )
  getImpactReport(@CurrentUser() user: AuthUser, @Query() query: BillingImpactQueryDto) {
    return this.billing.getBillingImpactReport(user, query);
  }

  @Get('subscriptions')
  @UseGuards(AnyPermissionsGuard)
  @RequireAnyPermissions(
    'billing.read',
    'billing.write',
    'institutions.read',
    'institutions.write',
  )
  listSubscriptions(@CurrentUser() user: AuthUser, @Query() query: ListBillingQueryDto) {
    return this.billing.listSubscriptions(user, query);
  }

  @Get('subscriptions/:id')
  @UseGuards(AnyPermissionsGuard)
  @RequireAnyPermissions(
    'billing.read',
    'billing.write',
    'institutions.read',
    'institutions.write',
  )
  getSubscription(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.billing.getSubscription(user, id);
  }

  @Get('invoices')
  @UseGuards(AnyPermissionsGuard)
  @RequireAnyPermissions(
    'billing.read',
    'billing.write',
    'institutions.read',
    'institutions.write',
  )
  listInvoices(@CurrentUser() user: AuthUser, @Query() query: ListBillingQueryDto) {
    return this.billing.listInvoices(user, query);
  }

  @Get('invoices/:id')
  @UseGuards(AnyPermissionsGuard)
  @RequireAnyPermissions(
    'billing.read',
    'billing.write',
    'institutions.read',
    'institutions.write',
  )
  getInvoice(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.billing.getInvoice(user, id);
  }

  @Get('disputes')
  @UseGuards(AnyPermissionsGuard)
  @RequireAnyPermissions(
    'billing.read',
    'billing.write',
    'institutions.read',
    'institutions.write',
  )
  listDisputes(@CurrentUser() user: AuthUser, @Query() query: ListBillingDisputesQueryDto) {
    return this.billingDisputes.list(user, query);
  }

  @Get('disputes/:id')
  @UseGuards(AnyPermissionsGuard)
  @RequireAnyPermissions(
    'billing.read',
    'billing.write',
    'institutions.read',
    'institutions.write',
  )
  getDispute(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.billingDisputes.getById(user, id);
  }

  @Post('invoices/:invoiceId/disputes')
  @UseGuards(AnyPermissionsGuard)
  @RequireAnyPermissions('billing.write')
  @ApiBody({ type: InitiateBillingDisputeDto })
  initiateDispute(
    @CurrentUser() user: AuthUser,
    @Param('invoiceId') invoiceId: string,
    @Body() body: InitiateBillingDisputeDto,
  ) {
    return this.billingDisputes.initiate(user, invoiceId, body);
  }

  @Post('disputes/:id/resolve')
  @UseGuards(AnyPermissionsGuard)
  @RequireAnyPermissions('*', 'billing.disputes.resolve')
  @ApiBody({ type: ResolveBillingDisputeDto })
  resolveDispute(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: ResolveBillingDisputeDto,
  ) {
    return this.billingDisputes.resolve(user, id, body);
  }

  @Get('snapshots/daily')
  @UseGuards(AnyPermissionsGuard)
  @RequireAnyPermissions(
    'billing.read',
    'billing.write',
    'institutions.read',
    'institutions.write',
  )
  listDailySnapshots(@CurrentUser() user: AuthUser, @Query() query: ListSnapshotsQueryDto) {
    return this.billing.listDailySnapshots(user, query);
  }

  @Post('snapshots/run-today')
  @UseGuards(AnyPermissionsGuard)
  @RequireAnyPermissions('billing.write')
  runDailySnapshots(@CurrentUser() user: AuthUser) {
    return this.billing.runDailySnapshotsNow(user);
  }

  @Post('snapshots/daily/lock')
  @UseGuards(AnyPermissionsGuard)
  @RequireAnyPermissions('*')
  @ApiBody({ type: LockDailySnapshotsDto })
  lockDailySnapshots(
    @CurrentUser() user: AuthUser,
    @Body() body: LockDailySnapshotsDto,
    @Req() req: Request,
  ) {
    return this.billing.lockDailySnapshots(user, body, {
      ipAddress: req.ip,
      userAgent: typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : undefined,
    });
  }

  @Post('snapshots/daily/unlock')
  @UseGuards(AnyPermissionsGuard)
  @RequireAnyPermissions('*')
  @ApiBody({ type: LockDailySnapshotsDto })
  unlockDailySnapshots(
    @CurrentUser() user: AuthUser,
    @Body() body: LockDailySnapshotsDto,
    @Req() req: Request,
  ) {
    return this.billing.unlockDailySnapshots(user, body, {
      ipAddress: req.ip,
      userAgent: typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : undefined,
    });
  }

  @Get('monthly-summaries')
  @UseGuards(AnyPermissionsGuard)
  @RequireAnyPermissions(
    'billing.read',
    'billing.write',
    'institutions.read',
    'institutions.write',
  )
  listMonthlySummaries(@CurrentUser() user: AuthUser, @Query() query: ListMonthlySummariesQueryDto) {
    return this.billing.listMonthlySummaries(user, query);
  }

  @Post('monthly-summaries/compute')
  @UseGuards(AnyPermissionsGuard)
  @RequireAnyPermissions('billing.write')
  @ApiBody({ type: MonthlyPeriodDto })
  computeMonthlyRollup(@CurrentUser() user: AuthUser, @Body() body: MonthlyPeriodDto) {
    return this.billing.computeMonthlyRollup(user, body);
  }

  @Post('invoices/generate-draft')
  @UseGuards(AnyPermissionsGuard)
  @RequireAnyPermissions('billing.write')
  @ApiBody({ type: GenerateDraftInvoiceDto })
  generateDraftInvoice(@CurrentUser() user: AuthUser, @Body() body: GenerateDraftInvoiceDto) {
    return this.billing.generateDraftInvoice(user, body);
  }

  @Post('invoices/:id/finalize')
  @UseGuards(AnyPermissionsGuard)
  @RequireAnyPermissions('billing.write')
  @ApiBody({ type: FinalizeInvoiceDto })
  finalizeInvoice(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: FinalizeInvoiceDto,
    @Req() req: Request,
  ) {
    return this.billing.finalizeInvoice(user, id, body, {
      ipAddress: req.ip,
      userAgent: typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : undefined,
    });
  }
}
