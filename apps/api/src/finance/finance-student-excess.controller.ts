import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequestStudentExcessRefundDto } from './dto/request-student-excess-refund.dto';
import { RequestStudentExcessTransferDto } from './dto/request-student-excess-transfer.dto';
import { FinanceService } from './finance.service';

/** Student self-service excess cash refund / transfer (BURSAR workflow approval). */
@Throttle({ default: { limit: 30, ttl: 60_000 } })
@Controller('finance/students')
@UseGuards(PermissionsGuard)
export class FinanceStudentExcessController {
  constructor(private readonly finance: FinanceService) {}

  @Get(':studentId/excess-credit')
  @RequirePermissions('finance.read')
  excessSummary(@CurrentUser() user: AuthUser, @Param('studentId') studentId: string) {
    return this.finance.getExcessCreditSummary(user, studentId);
  }

  @Post(':studentId/excess-refunds')
  @RequirePermissions('finance.read')
  requestRefund(
    @CurrentUser() user: AuthUser,
    @Param('studentId') studentId: string,
    @Body() dto: RequestStudentExcessRefundDto,
  ) {
    return this.finance.requestStudentExcessRefund(user, studentId, dto);
  }

  @Post(':studentId/excess-transfers')
  @RequirePermissions('finance.read')
  requestTransfer(
    @CurrentUser() user: AuthUser,
    @Param('studentId') studentId: string,
    @Body() dto: RequestStudentExcessTransferDto,
  ) {
    return this.finance.requestStudentExcessTransfer(user, studentId, dto);
  }
}
