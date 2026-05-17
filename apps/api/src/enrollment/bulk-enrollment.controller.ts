import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import type { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { BulkEnrollmentService } from './bulk-enrollment.service';
import { CreateBulkEnrollmentDto } from './dto/create-bulk-enrollment.dto';

@Controller('enrollments/bulk')
@UseGuards(PermissionsGuard)
export class BulkEnrollmentController {
  constructor(private readonly bulk: BulkEnrollmentService) {}

  @Post()
  @RequirePermissions('enrollments.write')
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateBulkEnrollmentDto) {
    return this.bulk.createJob(user, dto);
  }

  @Get(':jobId')
  @RequirePermissions('enrollments.read')
  getJob(@CurrentUser() user: AuthUser, @Param('jobId') jobId: string) {
    return this.bulk.getJob(user, jobId);
  }
}
