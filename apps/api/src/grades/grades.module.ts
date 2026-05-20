import { Module, forwardRef } from '@nestjs/common';
import { AnyPermissionsGuard } from '../common/guards/any-permissions.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { CustomizationModule } from '../modules/customization';
import { NotificationsModule } from '../modules/notifications';
import { WorkflowEngineModule } from '../workflow-engine/workflow-engine.module';
import { ProgressionModule } from '../progression/progression.module';
import { GradesController } from './grades.controller';
import { GradesRepository } from './grades.repository';
import { GradesService } from './grades.service';

@Module({
  imports: [
    CustomizationModule,
    ProgressionModule,
    NotificationsModule.register(),
    forwardRef(() => WorkflowEngineModule),
  ],
  controllers: [GradesController],
  providers: [GradesService, GradesRepository, PermissionsGuard, AnyPermissionsGuard],
  exports: [GradesService, GradesRepository],
})
export class GradesModule {}
