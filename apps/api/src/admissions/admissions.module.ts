import { Module, forwardRef } from '@nestjs/common';
import { StudentsModule } from '../students/students.module';
import { AnyPermissionsGuard } from '../common/guards/any-permissions.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { AdmissionsController } from './admissions.controller';
import { AdmissionsRepository } from './admissions.repository';
import { AdmissionsService } from './admissions.service';

@Module({
  imports: [forwardRef(() => StudentsModule)],
  controllers: [AdmissionsController],
  providers: [AdmissionsService, AdmissionsRepository, PermissionsGuard, AnyPermissionsGuard],
})
export class AdmissionsModule {}
