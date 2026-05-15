import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import type { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { CreateReactivationRequestDto } from './dto/create-reactivation-request.dto';
import { ListReactivationRequestsQueryDto } from './dto/list-reactivation-requests-query.dto';
import { ReviewReactivationRequestDto } from './dto/review-reactivation-request.dto';
import { ReactivationRequestService } from './reactivation-request.service';

@Controller('reactivation-requests')
@UseGuards(PermissionsGuard)
export class ReactivationRequestsController {
  constructor(private readonly reactivation: ReactivationRequestService) {}

  @Post()
  @RequirePermissions('students.write')
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateReactivationRequestDto) {
    return this.reactivation.create(user, dto);
  }

  @Get()
  @RequirePermissions('students.read')
  list(@CurrentUser() user: AuthUser, @Query() query: ListReactivationRequestsQueryDto) {
    return this.reactivation.list(user, query);
  }

  @Get(':id')
  @RequirePermissions('students.read')
  getById(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.reactivation.getById(user, id);
  }

  @Post(':id/approve')
  @RequirePermissions('students.reactivate')
  approve(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: ReviewReactivationRequestDto) {
    return this.reactivation.approve(user, id, dto);
  }

  @Post(':id/reject')
  @RequirePermissions('students.reactivate')
  reject(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: ReviewReactivationRequestDto) {
    return this.reactivation.reject(user, id, dto);
  }
}
