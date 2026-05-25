import { Controller, Get } from '@nestjs/common';
import type { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { DashboardService } from './dashboard.service';

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get('faculty')
  @Roles('FACULTY')
  faculty(@CurrentUser() user: AuthUser) {
    return this.dashboard.getFacultyHome(user);
  }

  @Get('staff')
  @Roles('STAFF')
  staff(@CurrentUser() user: AuthUser) {
    return this.dashboard.getStaffHome(user);
  }

  @Get('admin')
  @Roles('ADMIN')
  admin(@CurrentUser() user: AuthUser) {
    return this.dashboard.getAdminHome(user);
  }

  @Get('alumni')
  @Roles('ALUMNI')
  alumni(@CurrentUser() user: AuthUser) {
    return this.dashboard.getAlumniHome(user);
  }
}
