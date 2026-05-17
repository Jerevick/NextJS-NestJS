import { Module } from '@nestjs/common';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { GradesModule } from '../grades/grades.module';
import { ProgressionModule } from '../progression/progression.module';
import { LmsSharedModule } from '../lms/lms-shared.module';
import { LmsAssessmentsController } from './lms-assessments.controller';
import { LmsQuestionBankController } from './lms-question-bank.controller';
import { LmsAssessmentsRepository } from './lms-assessments.repository';
import { LmsQuestionBankRepository } from './lms-question-bank.repository';
import { LmsAssessmentsService } from './lms-assessments.service';
import { LmsQuestionBankService } from './lms-question-bank.service';
import { LmsSisPassbackService } from './lms-sis-passback.service';

@Module({
  imports: [LmsSharedModule, GradesModule, ProgressionModule],
  controllers: [LmsAssessmentsController, LmsQuestionBankController],
  providers: [
    LmsAssessmentsService,
    LmsQuestionBankRepository,
    LmsAssessmentsRepository,
    LmsQuestionBankService,
    LmsSisPassbackService,
    PermissionsGuard,
  ],
  exports: [LmsAssessmentsService],
})
export class LmsAssessmentsModule {}
