import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { RequireFinanceDirector } from '../common/decorators/require-finance-director.decorator';
import { StudentRecordWrite } from '../common/decorators/student-record-write.decorator';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { CreatePaymentPlanDto } from './dto/create-payment-plan.dto';
import { FinanceService } from './finance.service';
import { FinanceDirectorGuard } from './guards/finance-director.guard';

@Throttle({ default: { limit: 60, ttl: 60_000 } })
@Controller('finance/students')
@UseGuards(PermissionsGuard, FinanceDirectorGuard)
export class FinancePaymentPlansController {
  constructor(private readonly finance: FinanceService) {}

  @Post(':studentId/payment-plans')
  @RequirePermissions('finance.write')
  @RequireFinanceDirector()
  @StudentRecordWrite({ mode: 'paramStudentId', param: 'studentId', recordDate: { kind: 'now' } })
  create(
    @CurrentUser() user: AuthUser,
    @Param('studentId') studentId: string,
    @Body() dto: CreatePaymentPlanDto,
  ) {
    return this.finance.createPaymentPlan(user, studentId, dto);
  }
}
