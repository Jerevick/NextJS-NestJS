import { Module, forwardRef } from '@nestjs/common';
import { AnyPermissionsGuard } from '../common/guards/any-permissions.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { WorkflowEngineModule } from '../workflow-engine/workflow-engine.module';
import { ProgressionModule } from '../progression/progression.module';
import { GradesController } from './grades.controller';
import { GradesRepository } from './grades.repository';
import { GradesService } from './grades.service';

@Module({
  imports: [ProgressionModule, forwardRef(() => WorkflowEngineModule)],
  controllers: [GradesController],
  providers: [GradesService, GradesRepository, PermissionsGuard, AnyPermissionsGuard],
  exports: [GradesService, GradesRepository],
})
export class GradesModule {}
