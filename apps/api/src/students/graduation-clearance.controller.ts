import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import type { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { CreateGraduationClearanceDto } from './dto/create-graduation-clearance.dto';
import { GraduationClearanceService } from './graduation-clearance.service';

@Controller('graduation-clearance')
@UseGuards(PermissionsGuard)
export class GraduationClearanceController {
  constructor(private readonly clearance: GraduationClearanceService) {}

  @Get('students/:studentId')
  @RequirePermissions('students.read')
  listForStudent(@CurrentUser() user: AuthUser, @Param('studentId') studentId: string) {
    return this.clearance.listForStudent(user, studentId);
  }

  @Post()
  @RequirePermissions('students.write')
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateGraduationClearanceDto) {
    return this.clearance.create(user, dto);
  }

  @Get(':id')
  @RequirePermissions('students.read')
  getById(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.clearance.getById(user, id);
  }
}
