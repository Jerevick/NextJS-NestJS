import { Module, forwardRef } from '@nestjs/common';
import { WorkflowEngineModule } from '../workflow-engine/workflow-engine.module';
import { AnyPermissionsGuard } from '../common/guards/any-permissions.guard';
import { ProgressionController } from './progression.controller';
import { ProgressionService } from './progression.service';
import { GpaComputationService } from './gpa-computation.service';
import { ResitGradeService } from './resit-grade.service';

@Module({
  imports: [forwardRef(() => WorkflowEngineModule)],
  controllers: [ProgressionController],
  providers: [ProgressionService, GpaComputationService, ResitGradeService, AnyPermissionsGuard],
  exports: [ProgressionService, GpaComputationService, ResitGradeService],
})
export class ProgressionModule {}
