import { Module } from '@nestjs/common';
import { TenantModulesModule } from '../common/tenant-modules/tenant-modules.module';
import { LmsStudentAccessInterceptor } from './lms-student-access.interceptor';
import { LmsStudentEligibilityService } from './lms-student-eligibility.service';

@Module({
  imports: [TenantModulesModule],
  providers: [LmsStudentEligibilityService, LmsStudentAccessInterceptor],
  exports: [LmsStudentEligibilityService, LmsStudentAccessInterceptor],
})
export class LmsSharedModule {}
