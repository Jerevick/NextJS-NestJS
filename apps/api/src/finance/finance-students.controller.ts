import { Body, Controller, Get, Param, Post, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { Throttle } from '@nestjs/throttler';
import type { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequireFinanceDirector } from '../common/decorators/require-finance-director.decorator';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { FinanceDirectorGuard } from './guards/finance-director.guard';
import { StudentRecordWrite } from '../common/decorators/student-record-write.decorator';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { PostStudentChargeDto } from './dto/post-student-charge.dto';
import { PostStudentPaymentDto } from './dto/post-student-payment.dto';
import { RequestFeeWaiverDto } from './dto/request-fee-waiver.dto';
import { RequestFinanceRefundDto } from './dto/request-finance-refund.dto';
import { FinanceService } from './finance.service';

@Throttle({ default: { limit: 120, ttl: 60_000 } })
@Controller('finance/students')
@UseGuards(PermissionsGuard, FinanceDirectorGuard)
export class FinanceStudentsController {
  constructor(private readonly finance: FinanceService) {}

  @Get(':studentId/account')
  @RequirePermissions('finance.read')
  getAccount(@CurrentUser() user: AuthUser, @Param('studentId') studentId: string) {
    return this.finance.getStudentAccount(user, studentId);
  }

  @Post(':studentId/charges')
  @RequirePermissions('finance.write')
  @RequireFinanceDirector()
  @StudentRecordWrite({ mode: 'paramStudentId', param: 'studentId', recordDate: { kind: 'now' } })
  postCharge(
    @CurrentUser() user: AuthUser,
    @Param('studentId') studentId: string,
    @Body() dto: PostStudentChargeDto,
  ) {
    return this.finance.postCharge(user, studentId, dto);
  }

  @Post(':studentId/waivers')
  @RequirePermissions('finance.write')
  @RequireFinanceDirector()
  requestWaiver(
    @CurrentUser() user: AuthUser,
    @Param('studentId') studentId: string,
    @Body() dto: RequestFeeWaiverDto,
  ) {
    return this.finance.requestFeeWaiver(user, studentId, dto);
  }

  @Post(':studentId/refunds')
  @RequirePermissions('finance.write')
  @RequireFinanceDirector()
  requestRefund(
    @CurrentUser() user: AuthUser,
    @Param('studentId') studentId: string,
    @Body() dto: RequestFinanceRefundDto,
  ) {
    return this.finance.requestRefund(user, studentId, dto);
  }

  @Post(':studentId/payments')
  @RequirePermissions('finance.write')
  postPayment(
    @CurrentUser() user: AuthUser,
    @Param('studentId') studentId: string,
    @Body() dto: PostStudentPaymentDto,
  ) {
    return this.finance.postPayment(user, studentId, dto);
  }

  @Get(':studentId/transactions/:transactionId/receipt.pdf')
  @RequirePermissions('finance.read')
  async receipt(
    @CurrentUser() user: AuthUser,
    @Param('studentId') studentId: string,
    @Param('transactionId') transactionId: string,
    @Res() res: Response,
  ) {
    const { buffer, filename } = await this.finance.transactionReceiptPdf(
      user,
      studentId,
      transactionId,
    );
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    res.send(Buffer.from(buffer));
  }
}
