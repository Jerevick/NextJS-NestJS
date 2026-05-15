import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { BackfillRequestService } from './backfill-request.service';
import { CreateBackfillRequestDto } from './dto/create-backfill-request.dto';
import { ListBackfillRequestsQueryDto } from './dto/list-backfill-requests-query.dto';
import { EstimateBackfillFeeQueryDto } from './dto/estimate-backfill-fee-query.dto';
import { RejectBackfillRequestDto } from './dto/reject-backfill-request.dto';

@ApiTags('backfill-requests')
@Controller('backfill-requests')
@UseGuards(PermissionsGuard)
export class BackfillRequestsController {
  constructor(private readonly backfill: BackfillRequestService) {}

  @Get('estimate-fee')
  @RequirePermissions('backfill.request')
  estimateFee(@CurrentUser() user: AuthUser, @Query() query: EstimateBackfillFeeQueryDto) {
    return this.backfill.estimateRetroactiveFee(
      user,
      query.studentId,
      query.fromDate,
      query.toDate,
    );
  }

  @Post()
  @RequirePermissions('backfill.request')
  submit(@CurrentUser() user: AuthUser, @Body() dto: CreateBackfillRequestDto) {
    return this.backfill.submit(user, dto);
  }

  @Get()
  @RequirePermissions('backfill.read')
  list(@CurrentUser() user: AuthUser, @Query() query: ListBackfillRequestsQueryDto) {
    return this.backfill.list(user, query);
  }

  @Get(':id')
  @RequirePermissions('backfill.read')
  getById(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.backfill.getById(user, id);
  }

  @Post(':id/approve')
  @RequirePermissions('backfill.approve')
  approve(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.backfill.approve(user, id);
  }

  @Post(':id/reject')
  @RequirePermissions('backfill.approve')
  reject(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: RejectBackfillRequestDto) {
    return this.backfill.reject(user, id, dto);
  }

  @Post(':id/cancel')
  @RequirePermissions('backfill.request')
  cancel(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.backfill.cancel(user, id);
  }
}
