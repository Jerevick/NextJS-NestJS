import { Module } from '@nestjs/common';
import { AnyPermissionsGuard } from '../common/guards/any-permissions.guard';
import { SuperAdminModule } from '../super-admin/super-admin.module';
import { MonitoringController } from './monitoring.controller';
import { MonitoringService } from './monitoring.service';

@Module({
  imports: [SuperAdminModule],
  controllers: [MonitoringController],
  providers: [MonitoringService, AnyPermissionsGuard],
})
export class MonitoringModule {}
