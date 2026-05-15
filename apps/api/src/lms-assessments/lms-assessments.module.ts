import { Module } from '@nestjs/common';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { LmsAssessmentsController } from './lms-assessments.controller';
import { LmsAssessmentsRepository } from './lms-assessments.repository';
import { LmsAssessmentsService } from './lms-assessments.service';

@Module({
  controllers: [LmsAssessmentsController],
  providers: [LmsAssessmentsService, LmsAssessmentsRepository, PermissionsGuard],
})
export class LmsAssessmentsModule {}
