import { Module } from '@nestjs/common';
import { LmsStudentAccessInterceptor } from './lms-student-access.interceptor';
import { LmsStudentEligibilityService } from './lms-student-eligibility.service';

@Module({
  providers: [LmsStudentEligibilityService, LmsStudentAccessInterceptor],
  exports: [LmsStudentEligibilityService, LmsStudentAccessInterceptor],
})
export class LmsSharedModule {}
