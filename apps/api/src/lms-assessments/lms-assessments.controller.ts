import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import type { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { StudentRecordWrite } from '../common/decorators/student-record-write.decorator';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { LmsStudentAccessInterceptor } from '../lms/lms-student-access.interceptor';
import type { StudentRecordBackfillContext } from '../common/record-posting/student-record-backfill.context';
import { CompleteLmsLessonDto } from './dto/complete-lms-lesson.dto';
import { CreateLmsAssessmentDto } from './dto/create-lms-assessment.dto';
import { CreateLmsQuestionDto } from './dto/create-lms-question.dto';
import { ImportBankItemsToAssessmentDto } from './dto/import-bank-items-to-assessment.dto';
import { UpdateLmsQuestionDto } from './dto/update-lms-question.dto';
import { CreateLmsSubmissionDto } from './dto/create-lms-submission.dto';
import { StartQuizAttemptDto } from './dto/start-quiz-attempt.dto';
import { GradeLmsSubmissionDto } from './dto/grade-lms-submission.dto';
import { SubmitLmsSubmissionDto } from './dto/submit-lms-submission.dto';
import { SaveQuizDraftDto } from './dto/save-quiz-draft.dto';
import { UpdateLmsAssessmentDto } from './dto/update-lms-assessment.dto';
import { LmsAssessmentsService } from './lms-assessments.service';

type RequestWithBackfill = Request & { backfillContext?: StudentRecordBackfillContext };

@Throttle({ default: { limit: 120, ttl: 60_000 } })
@Controller('lms')
@UseGuards(PermissionsGuard)
@UseInterceptors(LmsStudentAccessInterceptor)
export class LmsAssessmentsController {
  constructor(private readonly assessments: LmsAssessmentsService) {}

  @Get('course-instances/:courseInstanceId/assessments')
  @RequirePermissions('lms.read')
  listAssessments(
    @CurrentUser() user: AuthUser,
    @Param('courseInstanceId') courseInstanceId: string,
  ) {
    return this.assessments.listAssessments(user, courseInstanceId);
  }

  @Get('course-instances/:courseInstanceId/teacher/gradebook')
  @RequirePermissions('lms.write')
  getTeacherGradebook(
    @CurrentUser() user: AuthUser,
    @Param('courseInstanceId') courseInstanceId: string,
  ) {
    return this.assessments.getTeacherGradebook(user, courseInstanceId);
  }

  @Get('course-instances/:courseInstanceId/teacher/analytics')
  @RequirePermissions('lms.write')
  getTeacherAnalytics(
    @CurrentUser() user: AuthUser,
    @Param('courseInstanceId') courseInstanceId: string,
  ) {
    return this.assessments.getTeacherAnalytics(user, courseInstanceId);
  }

  @Post('course-instances/:courseInstanceId/assessments')
  @RequirePermissions('lms.write')
  createAssessment(
    @CurrentUser() user: AuthUser,
    @Param('courseInstanceId') courseInstanceId: string,
    @Body() dto: CreateLmsAssessmentDto,
  ) {
    return this.assessments.createAssessment(user, courseInstanceId, dto);
  }

  @Get('course-instances/:courseInstanceId/progress')
  @RequirePermissions('lms.read')
  getProgress(
    @CurrentUser() user: AuthUser,
    @Param('courseInstanceId') courseInstanceId: string,
    @Query('studentId') studentId: string,
  ) {
    return this.assessments.getProgress(user, courseInstanceId, studentId);
  }

  @Get('assessments/:id')
  @RequirePermissions('lms.read')
  getAssessment(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.assessments.getAssessment(user, id);
  }

  @Patch('assessments/:id')
  @RequirePermissions('lms.write')
  updateAssessment(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateLmsAssessmentDto,
  ) {
    return this.assessments.updateAssessment(user, id, dto);
  }

  @Post('assessments/:assessmentId/questions')
  @RequirePermissions('lms.write')
  createAssessmentQuestion(
    @CurrentUser() user: AuthUser,
    @Param('assessmentId') assessmentId: string,
    @Body() dto: CreateLmsQuestionDto,
  ) {
    return this.assessments.createAssessmentQuestion(user, assessmentId, dto);
  }

  @Post('assessments/:assessmentId/questions/import-from-bank')
  @RequirePermissions('lms.write')
  importAssessmentQuestionsFromBank(
    @CurrentUser() user: AuthUser,
    @Param('assessmentId') assessmentId: string,
    @Body() dto: ImportBankItemsToAssessmentDto,
  ) {
    return this.assessments.importAssessmentQuestionsFromBank(user, assessmentId, dto);
  }

  @Patch('questions/:questionId')
  @RequirePermissions('lms.write')
  updateAssessmentQuestion(
    @CurrentUser() user: AuthUser,
    @Param('questionId') questionId: string,
    @Body() dto: UpdateLmsQuestionDto,
  ) {
    return this.assessments.updateAssessmentQuestion(user, questionId, dto);
  }

  @Delete('questions/:questionId')
  @RequirePermissions('lms.write')
  removeAssessmentQuestion(@CurrentUser() user: AuthUser, @Param('questionId') questionId: string) {
    return this.assessments.removeAssessmentQuestion(user, questionId);
  }

  @Delete('assessments/:id')
  @RequirePermissions('lms.write')
  removeAssessment(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.assessments.removeAssessment(user, id);
  }

  @Get('assessments/:assessmentId/submissions')
  @RequirePermissions('lms.read')
  listSubmissions(@CurrentUser() user: AuthUser, @Param('assessmentId') assessmentId: string) {
    return this.assessments.listSubmissions(user, assessmentId);
  }

  @Post('assessments/:assessmentId/attempts')
  @RequirePermissions('lms.read')
  @StudentRecordWrite({
    mode: 'bodyStudentId',
    studentIdField: 'studentId',
    recordDate: { kind: 'now' },
  })
  startQuizAttempt(
    @CurrentUser() user: AuthUser,
    @Param('assessmentId') assessmentId: string,
    @Body() dto: StartQuizAttemptDto,
  ) {
    return this.assessments.startQuizAttempt(user, assessmentId, dto);
  }

  @Get('assessments/:assessmentId/attempts/current')
  @RequirePermissions('lms.read')
  getCurrentQuizAttempt(
    @CurrentUser() user: AuthUser,
    @Param('assessmentId') assessmentId: string,
    @Query('studentId') studentId: string,
  ) {
    return this.assessments.getCurrentQuizAttempt(user, assessmentId, studentId);
  }

  @Patch('submissions/:submissionId/quiz-draft')
  @RequirePermissions('lms.read')
  @StudentRecordWrite({
    mode: 'lmsSubmissionIdParam',
    param: 'submissionId',
    recordDate: { kind: 'now' },
  })
  saveQuizDraft(
    @CurrentUser() user: AuthUser,
    @Param('submissionId') submissionId: string,
    @Body() dto: SaveQuizDraftDto,
  ) {
    return this.assessments.saveQuizDraft(user, submissionId, dto);
  }

  @Post('assessments/:assessmentId/submissions')
  @RequirePermissions('lms.write')
  @StudentRecordWrite({
    mode: 'bodyStudentId',
    studentIdField: 'studentId',
    recordDate: { kind: 'now' },
  })
  createSubmission(
    @CurrentUser() user: AuthUser,
    @Param('assessmentId') assessmentId: string,
    @Body() dto: CreateLmsSubmissionDto,
    @Req() req: RequestWithBackfill,
  ) {
    return this.assessments.createSubmission(user, assessmentId, dto, req.backfillContext);
  }

  @Post('submissions/:submissionId/submit')
  @RequirePermissions('lms.write')
  @StudentRecordWrite({
    mode: 'lmsSubmissionIdParam',
    param: 'submissionId',
    recordDate: { kind: 'now' },
  })
  submitSubmission(
    @CurrentUser() user: AuthUser,
    @Param('submissionId') submissionId: string,
    @Body() dto: SubmitLmsSubmissionDto,
    @Req() req: RequestWithBackfill,
  ) {
    return this.assessments.submitSubmission(user, submissionId, dto, req.backfillContext);
  }

  @Patch('submissions/:submissionId/grade')
  @RequirePermissions('lms.write')
  @StudentRecordWrite({
    mode: 'lmsSubmissionIdParam',
    param: 'submissionId',
    recordDate: { kind: 'now' },
  })
  gradeSubmission(
    @CurrentUser() user: AuthUser,
    @Param('submissionId') submissionId: string,
    @Body() dto: GradeLmsSubmissionDto,
    @Req() req: RequestWithBackfill,
  ) {
    return this.assessments.gradeSubmission(user, submissionId, dto, req.backfillContext);
  }

  @Post('lessons/:lessonId/complete')
  @RequirePermissions('lms.read')
  @StudentRecordWrite({
    mode: 'bodyStudentId',
    studentIdField: 'studentId',
    recordDate: { kind: 'now' },
  })
  completeLesson(
    @CurrentUser() user: AuthUser,
    @Param('lessonId') lessonId: string,
    @Body() dto: CompleteLmsLessonDto,
  ) {
    return this.assessments.completeLesson(user, lessonId, dto);
  }
}
