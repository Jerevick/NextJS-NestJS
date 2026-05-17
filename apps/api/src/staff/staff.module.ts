import { forwardRef, Module } from '@nestjs/common';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { WorkflowEngineModule } from '../workflow-engine/workflow-engine.module';
import { StaffController } from './staff.controller';
import { StaffRepository } from './staff.repository';
import { StaffService } from './staff.service';

@Module({
  imports: [forwardRef(() => WorkflowEngineModule)],
  controllers: [StaffController],
  providers: [StaffService, StaffRepository, PermissionsGuard],
  exports: [StaffService],
})
export class StaffModule {}
