import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { LmsQuestionType, LmsSubmissionStatus, Prisma } from '@prisma/client';
import type { AuthUser } from '../auth/auth.types';
import { AuditService } from '../audit/audit.service';
import type { StudentRecordBackfillContext } from '../common/record-posting/student-record-backfill.context';
import type { CreateLmsAssessmentDto } from './dto/create-lms-assessment.dto';
import type { CreateLmsQuestionDto } from './dto/create-lms-question.dto';
import type { CreateLmsSubmissionDto } from './dto/create-lms-submission.dto';
import type { GradeLmsSubmissionDto } from './dto/grade-lms-submission.dto';
import type { SubmitLmsSubmissionDto } from './dto/submit-lms-submission.dto';
import type { UpdateLmsQuestionDto } from './dto/update-lms-question.dto';
import type { UpdateLmsAssessmentDto } from './dto/update-lms-assessment.dto';
import type { CompleteLmsLessonDto } from './dto/complete-lms-lesson.dto';
import type { ImportBankItemsToAssessmentDto } from './dto/import-bank-items-to-assessment.dto';
import { LmsAssessmentsRepository } from './lms-assessments.repository';
import { LmsQuestionBankRepository } from './lms-question-bank.repository';
import { readLmsQuizSettings } from './lms-quiz-settings.util';
import type { StartQuizAttemptDto } from './dto/start-quiz-attempt.dto';
import type { SaveQuizDraftDto } from './dto/save-quiz-draft.dto';
import { scoreMcqSubmission } from './lms-quiz-autograde.util';
import { assertValidLmsQuestionContent } from './lms-question-content.util';
import { LmsStudentEligibilityService } from '../lms/lms-student-eligibility.service';
import { LmsSisPassbackService } from './lms-sis-passback.service';
import { deriveEnrollmentPercentScoreFromSubmissionGrade } from './lms-sis-passback.util';

@Injectable()
export class LmsAssessmentsService {
  constructor(
    private readonly repo: LmsAssessmentsRepository,
    private readonly bankRepo: LmsQuestionBankRepository,
    private readonly audit: AuditService,
    private readonly studentLmsEligibility: LmsStudentEligibilityService,
    private readonly sisPassback: LmsSisPassbackService,
  ) {}

  private scopeEntityId(actor: AuthUser): string | undefined {
    return actor.entityScope === 'ALL' ? undefined : actor.entityId;
  }

  async listAssessments(actor: AuthUser, courseInstanceId: string) {
    const course = await this.repo.findCourseInstance(
      actor.institutionId,
      courseInstanceId,
      this.scopeEntityId(actor),
    );
    if (!course) {
      throw new NotFoundException('Course instance not found');
    }
    await this.studentLmsEligibility.assertStudentEnrolledForCourseSection(actor, course.sectionId);
    const rows = await this.repo.listAssessments(actor.institutionId, courseInstanceId);
    return { data: rows.map((r) => this.serializeAssessment(r)) };
  }

  async getAssessment(actor: AuthUser, id: string) {
    const row = await this.repo.findAssessment(actor.institutionId, id, this.scopeEntityId(actor));
    if (!row) {
      throw new NotFoundException('Assessment not found');
    }
    await this.studentLmsEligibility.assertStudentEnrolledForAssessment(
      actor,
      id,
      this.scopeEntityId(actor),
    );
    return this.serializeAssessmentDetail(row, actor.permissions.includes('lms.write'));
  }

  async createAssessment(actor: AuthUser, courseInstanceId: string, dto: CreateLmsAssessmentDto) {
    const course = await this.repo.findCourseInstance(
      actor.institutionId,
      courseInstanceId,
      this.scopeEntityId(actor),
    );
    if (!course) {
      throw new NotFoundException('Course instance not found');
    }
    await this.studentLmsEligibility.assertStudentEnrolledForCourseSection(actor, course.sectionId);
    const row = await this.repo.createAssessment({
      courseInstanceId,
      institutionId: actor.institutionId,
      title: dto.title.trim(),
      type: dto.type ?? 'ASSIGNMENT',
      instructions: dto.instructions?.trim() ?? null,
      dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
      totalPoints: dto.totalPoints ?? 100,
      settings: (dto.settings ?? {}) as Prisma.InputJsonValue,
      rubric: (dto.rubric ?? {}) as Prisma.InputJsonValue,
    });
    this.audit.append({
      institutionId: actor.institutionId,
      actorId: actor.userId,
      action: 'lms.assessment.create',
      entity: 'LmsAssessment',
      entityId: row.id,
      newValues: { courseInstanceId, title: row.title } as Prisma.InputJsonValue,
    });
    return this.serializeAssessment(row);
  }

  async updateAssessment(actor: AuthUser, id: string, dto: UpdateLmsAssessmentDto) {
    const prior = await this.repo.findAssessment(
      actor.institutionId,
      id,
      this.scopeEntityId(actor),
    );
    if (!prior) {
      throw new NotFoundException('Assessment not found');
    }
    await this.studentLmsEligibility.assertStudentEnrolledForAssessment(
      actor,
      id,
      this.scopeEntityId(actor),
    );
    const data: Prisma.LmsAssessmentUpdateInput = {};
    if (dto.title !== undefined) {
      data.title = dto.title.trim();
    }
    if (dto.type !== undefined) {
      data.type = dto.type;
    }
    if (dto.instructions !== undefined) {
      data.instructions = dto.instructions;
    }
    if (dto.dueDate !== undefined) {
      data.dueDate = dto.dueDate ? new Date(dto.dueDate) : null;
    }
    if (dto.totalPoints !== undefined) {
      data.totalPoints = dto.totalPoints;
    }
    if (dto.settings !== undefined) {
      data.settings = dto.settings as Prisma.InputJsonValue;
    }
    if (dto.rubric !== undefined) {
      data.rubric = dto.rubric as Prisma.InputJsonValue;
    }
    await this.repo.updateAssessment(id, actor.institutionId, data);
    return this.getAssessment(actor, id);
  }

  async removeAssessment(actor: AuthUser, id: string) {
    const prior = await this.repo.findAssessment(
      actor.institutionId,
      id,
      this.scopeEntityId(actor),
    );
    if (!prior) {
      throw new NotFoundException('Assessment not found');
    }
    await this.studentLmsEligibility.assertStudentEnrolledForAssessment(
      actor,
      id,
      this.scopeEntityId(actor),
    );
    await this.repo.softDeleteAssessment(id, actor.institutionId, new Date());
    this.audit.append({
      institutionId: actor.institutionId,
      actorId: actor.userId,
      action: 'lms.assessment.delete',
      entity: 'LmsAssessment',
      entityId: id,
    });
    return { deleted: true as const };
  }

  async listSubmissions(actor: AuthUser, assessmentId: string) {
    const assessment = await this.repo.findAssessment(
      actor.institutionId,
      assessmentId,
      this.scopeEntityId(actor),
    );
    if (!assessment) {
      throw new NotFoundException('Assessment not found');
    }
    await this.studentLmsEligibility.assertStudentEnrolledForAssessment(
      actor,
      assessmentId,
      this.scopeEntityId(actor),
    );
    const rows = await this.repo.listSubmissions(actor.institutionId, assessmentId);
    return { data: rows.map((r) => this.serializeSubmission(r)) };
  }

  async startQuizAttempt(actor: AuthUser, assessmentId: string, dto: StartQuizAttemptDto) {
    const assessment = await this.repo.findAssessment(
      actor.institutionId,
      assessmentId,
      this.scopeEntityId(actor),
    );
    if (!assessment) {
      throw new NotFoundException('Assessment not found');
    }
    await this.studentLmsEligibility.assertStudentEnrolledForAssessment(
      actor,
      assessmentId,
      this.scopeEntityId(actor),
    );
    const student = await this.repo.findStudent(
      actor.institutionId,
      dto.studentId,
      this.scopeEntityId(actor),
    );
    if (!student) {
      throw new NotFoundException('Student not found');
    }
    this.studentLmsEligibility.assertStudentTargetsSelf(actor, dto.studentId);

    const quiz = readLmsQuizSettings(assessment.settings);
    const now = new Date();

    const active = await this.repo.findActiveDraftAttempt(
      actor.institutionId,
      assessmentId,
      dto.studentId,
    );
    if (active) {
      if (active.expiresAt && active.expiresAt <= now) {
        await this.repo.updateSubmission(active.id, {
          status: LmsSubmissionStatus.SUBMITTED,
          submittedAt: now,
        });
      } else {
        return this.serializeQuizAttempt(active, assessment, quiz);
      }
    }

    const used = await this.repo.countSubmissionsForStudent(
      actor.institutionId,
      assessmentId,
      dto.studentId,
    );
    if (used >= quiz.maxAttempts) {
      throw new ConflictException(
        `Maximum attempts (${quiz.maxAttempts}) reached for this assessment`,
      );
    }

    const startedAt = now;
    const expiresAt =
      quiz.timeLimitMinutes !== null
        ? new Date(startedAt.getTime() + quiz.timeLimitMinutes * 60_000)
        : null;

    const row = await this.repo.createSubmission({
      assessmentId,
      studentId: dto.studentId,
      institutionId: actor.institutionId,
      answers: {} as Prisma.InputJsonValue,
      status: LmsSubmissionStatus.DRAFT,
      attemptNumber: used + 1,
      startedAt,
      expiresAt,
    });

    this.audit.append({
      institutionId: actor.institutionId,
      actorId: actor.userId,
      action: 'lms.quiz.attempt.start',
      entity: 'LmsSubmission',
      entityId: row.id,
      newValues: {
        assessmentId,
        studentId: dto.studentId,
        attemptNumber: used + 1,
        expiresAt: expiresAt?.toISOString() ?? null,
      } as Prisma.InputJsonValue,
    });

    const withQuestions = await this.repo.findActiveDraftAttempt(
      actor.institutionId,
      assessmentId,
      dto.studentId,
    );
    if (withQuestions) {
      return this.serializeQuizAttempt(withQuestions, assessment, quiz);
    }
    return this.serializeQuizAttempt(
      {
        ...row,
        assessment: {
          title: assessment.title,
          type: assessment.type,
          questions: assessment.questions,
        },
      },
      assessment,
      quiz,
    );
  }

  async saveQuizDraft(actor: AuthUser, submissionId: string, dto: SaveQuizDraftDto) {
    const prior = await this.repo.findSubmission(
      actor.institutionId,
      submissionId,
      this.scopeEntityId(actor),
    );
    if (!prior) {
      throw new NotFoundException('Submission not found');
    }
    this.studentLmsEligibility.assertStudentTargetsSelf(actor, prior.studentId);
    await this.studentLmsEligibility.assertStudentEnrolledForAssessment(
      actor,
      prior.assessmentId,
      this.scopeEntityId(actor),
    );
    if (prior.status !== LmsSubmissionStatus.DRAFT) {
      throw new BadRequestException('Only in-progress quiz attempts can be autosaved');
    }
    const aType = prior.assessment.type;
    if (aType !== 'QUIZ' && aType !== 'EXAM') {
      throw new BadRequestException('Autosave is only supported for quizzes and exams');
    }
    if (prior.expiresAt && new Date() > prior.expiresAt) {
      throw new BadRequestException('Quiz attempt time has expired');
    }

    const base = (
      typeof prior.answers === 'object' && prior.answers !== null ? { ...prior.answers } : {}
    ) as Record<string, unknown>;
    if (dto.answers && typeof dto.answers === 'object') {
      for (const [k, v] of Object.entries(dto.answers)) {
        if (typeof v === 'string') {
          base[k] = v;
        }
      }
    }

    await this.repo.updateSubmission(submissionId, { answers: base as Prisma.InputJsonValue });

    const now = new Date();
    return {
      saved: true as const,
      serverNow: now.toISOString(),
      expiresAt: prior.expiresAt?.toISOString() ?? null,
    };
  }

  async getCurrentQuizAttempt(actor: AuthUser, assessmentId: string, studentId: string) {
    const assessment = await this.repo.findAssessment(
      actor.institutionId,
      assessmentId,
      this.scopeEntityId(actor),
    );
    if (!assessment) {
      throw new NotFoundException('Assessment not found');
    }
    await this.studentLmsEligibility.assertStudentEnrolledForAssessment(
      actor,
      assessmentId,
      this.scopeEntityId(actor),
    );
    this.studentLmsEligibility.assertStudentTargetsSelf(actor, studentId);
    const draft = await this.repo.findActiveDraftAttempt(
      actor.institutionId,
      assessmentId,
      studentId,
    );
    if (!draft) {
      return { attempt: null };
    }
    const quiz = readLmsQuizSettings(assessment.settings);
    return { attempt: this.serializeQuizAttempt(draft, assessment, quiz) };
  }

  async getTeacherGradebook(actor: AuthUser, courseInstanceId: string) {
    const scope = this.scopeEntityId(actor);
    const course = await this.repo.findCourseInstance(actor.institutionId, courseInstanceId, scope);
    if (!course) {
      throw new NotFoundException('Course instance not found');
    }
    await this.studentLmsEligibility.assertStudentEnrolledForCourseInstance(
      actor,
      courseInstanceId,
      scope,
    );

    const [roster, assessmentRows, submissions] = await Promise.all([
      this.repo.listTeacherRoster(actor.institutionId, course.sectionId, scope),
      this.repo.listAssessments(actor.institutionId, courseInstanceId),
      this.repo.listSubmissionsForTeacherGradebook(actor.institutionId, courseInstanceId),
    ]);

    const bestByPair = new Map<string, (typeof submissions)[number]>();
    for (const s of submissions) {
      const pair = `${s.assessmentId}:${s.studentId}`;
      if (!bestByPair.has(pair)) {
        bestByPair.set(pair, s);
      }
    }

    const terminalStatuses = new Set<string>([
      LmsSubmissionStatus.SUBMITTED,
      LmsSubmissionStatus.GRADED,
      LmsSubmissionStatus.LATE,
    ]);

    const cells = [...bestByPair.values()].map((s) => {
      let percentScore: number | null = null;
      if (terminalStatuses.has(s.status) && s.grade) {
        percentScore = deriveEnrollmentPercentScoreFromSubmissionGrade(
          s.grade,
          s.assessment.totalPoints,
        );
      }
      return {
        submissionId: s.id,
        assessmentId: s.assessmentId,
        studentId: s.studentId,
        status: s.status,
        attemptNumber: s.attemptNumber,
        percentScore,
        submittedAt: s.submittedAt?.toISOString() ?? null,
      };
    });

    return {
      courseInstanceId,
      sectionId: course.sectionId,
      roster: roster.map((r) => ({
        enrollmentId: r.id,
        studentId: r.studentId,
        studentNumber: r.student.studentNumber,
        enrollmentStatus: r.status,
        displayLabel:
          typeof r.student.user?.email === 'string' && r.student.user.email.trim()
            ? `${r.student.studentNumber} · ${r.student.user.email}`
            : r.student.studentNumber,
      })),
      assessments: assessmentRows.map((a) => ({
        id: a.id,
        title: a.title,
        type: a.type,
        totalPoints: a.totalPoints,
        dueDate: a.dueDate?.toISOString() ?? null,
      })),
      cells,
    };
  }

  async getTeacherAnalytics(actor: AuthUser, courseInstanceId: string) {
    const gb = await this.getTeacherGradebook(actor, courseInstanceId);
    const rosterDen = Math.max(gb.roster.length, 1);

    const byAssessment = new Map<string, { submitted: number; scores: number[] }>();
    for (const a of gb.assessments) {
      byAssessment.set(a.id, { submitted: 0, scores: [] });
    }

    const terminalStatuses = new Set<string>([
      LmsSubmissionStatus.SUBMITTED,
      LmsSubmissionStatus.GRADED,
      LmsSubmissionStatus.LATE,
    ]);

    for (const c of gb.cells) {
      const bucket = byAssessment.get(c.assessmentId);
      if (!bucket) {
        continue;
      }
      if (terminalStatuses.has(c.status)) {
        bucket.submitted += 1;
      }
      if (c.status === LmsSubmissionStatus.GRADED && c.percentScore !== null) {
        bucket.scores.push(c.percentScore);
      }
    }

    const assessmentInsights = gb.assessments.map((a) => {
      const b = byAssessment.get(a.id) ?? { submitted: 0, scores: [] };
      const avgScore = b.scores.length
        ? b.scores.reduce((x, y) => x + y, 0) / b.scores.length
        : null;
      return {
        assessmentId: a.id,
        title: a.title,
        type: a.type,
        submissionRate: Math.min(1, b.submitted / rosterDen),
        avgPercentScoreWhenGraded: avgScore !== null ? Math.round(avgScore * 10) / 10 : null,
      };
    });

    const lessons = await this.repo.listPublishedLessonMetaForCourse(
      actor.institutionId,
      courseInstanceId,
    );
    const lessonIds = lessons.map((l) => l.id);
    const counts = await this.repo.countLessonCompletionsGrouped(actor.institutionId, lessonIds);
    const countMap = new Map(counts.map((row) => [row.lessonId, row._count._all]));

    const lessonCompletion = lessons.map((l) => ({
      lessonId: l.id,
      title: l.title,
      moduleTitle: l.module.title,
      completedCount: countMap.get(l.id) ?? 0,
      completionRate: Math.min(1, (countMap.get(l.id) ?? 0) / rosterDen),
    }));

    return {
      rosterCount: gb.roster.length,
      assessmentInsights,
      lessonCompletion,
    };
  }

  async createSubmission(
    actor: AuthUser,
    assessmentId: string,
    dto: CreateLmsSubmissionDto,
    backfill?: StudentRecordBackfillContext,
  ) {
    const assessment = await this.repo.findAssessment(
      actor.institutionId,
      assessmentId,
      this.scopeEntityId(actor),
    );
    if (!assessment) {
      throw new NotFoundException('Assessment not found');
    }
    await this.studentLmsEligibility.assertStudentEnrolledForAssessment(
      actor,
      assessmentId,
      this.scopeEntityId(actor),
    );
    this.studentLmsEligibility.assertStudentTargetsSelf(actor, dto.studentId);
    if (assessment.type === 'QUIZ' || assessment.type === 'EXAM') {
      return this.startQuizAttempt(actor, assessmentId, { studentId: dto.studentId });
    }
    const student = await this.repo.findStudent(
      actor.institutionId,
      dto.studentId,
      this.scopeEntityId(actor),
    );
    if (!student) {
      throw new NotFoundException('Student not found');
    }
    const existing = await this.repo.findSubmissionForStudent(
      actor.institutionId,
      assessmentId,
      dto.studentId,
    );
    if (existing && existing.status === LmsSubmissionStatus.DRAFT) {
      throw new ConflictException('Submission already exists for this student');
    }
    if (existing && existing.status !== LmsSubmissionStatus.DRAFT) {
      throw new ConflictException('Submission already exists for this student');
    }
    const row = await this.repo.createSubmission({
      assessmentId,
      studentId: dto.studentId,
      institutionId: actor.institutionId,
      answers: (dto.answers ?? {}) as Prisma.InputJsonValue,
      status: LmsSubmissionStatus.DRAFT,
      attemptNumber: 1,
    });
    this.audit.append({
      institutionId: actor.institutionId,
      actorId: actor.userId,
      action: 'lms.submission.create',
      entity: 'LmsSubmission',
      entityId: row.id,
      newValues: {
        assessmentId,
        studentId: dto.studentId,
        isBackfilled: backfill?.isBackfilled ?? false,
      } as Prisma.InputJsonValue,
    });
    return this.serializeSubmission(row);
  }

  async submitSubmission(
    actor: AuthUser,
    submissionId: string,
    dto: SubmitLmsSubmissionDto,
    backfill?: StudentRecordBackfillContext,
  ) {
    const prior = await this.repo.findSubmission(
      actor.institutionId,
      submissionId,
      this.scopeEntityId(actor),
    );
    if (!prior) {
      throw new NotFoundException('Submission not found');
    }
    this.studentLmsEligibility.assertStudentTargetsSelf(actor, prior.studentId);
    await this.studentLmsEligibility.assertStudentEnrolledForAssessment(
      actor,
      prior.assessmentId,
      this.scopeEntityId(actor),
    );
    if (
      prior.status !== LmsSubmissionStatus.DRAFT &&
      prior.status !== LmsSubmissionStatus.RETURNED
    ) {
      throw new BadRequestException('Only draft or returned submissions can be submitted');
    }
    if (prior.expiresAt && new Date() > prior.expiresAt) {
      throw new BadRequestException('Quiz attempt time has expired');
    }
    const isLate =
      prior.assessment.dueDate !== null &&
      prior.assessment.dueDate !== undefined &&
      new Date() > prior.assessment.dueDate;
    const answersObj = (dto.answers ?? prior.answers) as Record<string, unknown>;
    const answersJson = answersObj as Prisma.InputJsonValue;

    let status: LmsSubmissionStatus = isLate
      ? LmsSubmissionStatus.LATE
      : LmsSubmissionStatus.SUBMITTED;
    let gradePayload: Prisma.InputJsonValue | undefined;
    let gradedAt: Date | undefined;

    const assessmentType = prior.assessment.type;
    if (assessmentType === 'QUIZ' || assessmentType === 'EXAM') {
      const full = await this.repo.findAssessment(
        actor.institutionId,
        prior.assessmentId,
        this.scopeEntityId(actor),
      );
      if (full) {
        const quiz = readLmsQuizSettings(full.settings);
        if (quiz.autoGradeMcq) {
          const scored = scoreMcqSubmission(full.questions, answersObj);
          gradePayload = {
            autoGraded: true,
            earned: scored.earned,
            maxMcqPoints: scored.maxMcqPoints,
            assessmentTotalPoints: full.totalPoints,
            breakdown: scored.breakdown,
          } as Prisma.InputJsonValue;
          if (scored.allQuestionsAreMcq) {
            status = isLate ? LmsSubmissionStatus.LATE : LmsSubmissionStatus.GRADED;
            gradedAt = new Date();
          }
        }
      }
    }

    const row = await this.repo.updateSubmission(submissionId, {
      answers: answersJson,
      status,
      submittedAt: new Date(),
      ...(gradePayload ? { grade: gradePayload } : {}),
      ...(gradedAt ? { gradedAt } : {}),
    });
    this.audit.append({
      institutionId: actor.institutionId,
      actorId: actor.userId,
      action: 'lms.submission.submit',
      entity: 'LmsSubmission',
      entityId: submissionId,
      newValues: { isBackfilled: backfill?.isBackfilled ?? false } as Prisma.InputJsonValue,
    });
    if (status === LmsSubmissionStatus.GRADED && gradePayload) {
      await this.sisPassback.tryPassbackEnrollmentGradeFromGradedSubmission(actor, {
        submissionId,
        studentId: prior.studentId,
        courseInstanceId: prior.assessment.courseInstanceId,
        assessmentId: prior.assessmentId,
        assessmentSettings: prior.assessment.settings,
        assessmentTotalPoints: prior.assessment.totalPoints,
        grade: gradePayload,
      });
    }
    return this.serializeSubmission(row);
  }

  async gradeSubmission(
    actor: AuthUser,
    submissionId: string,
    dto: GradeLmsSubmissionDto,
    backfill?: StudentRecordBackfillContext,
  ) {
    if (actor.role === 'STUDENT') {
      throw new ForbiddenException('Students cannot grade LMS submissions.');
    }
    const prior = await this.repo.findSubmission(
      actor.institutionId,
      submissionId,
      this.scopeEntityId(actor),
    );
    if (!prior) {
      throw new NotFoundException('Submission not found');
    }
    const row = await this.repo.updateSubmission(submissionId, {
      grade: dto.grade as Prisma.InputJsonValue,
      feedback: dto.feedback?.trim() ?? null,
      status: LmsSubmissionStatus.GRADED,
      gradedBy: { connect: { id: actor.userId } },
      gradedAt: new Date(),
    });
    this.audit.append({
      institutionId: actor.institutionId,
      actorId: actor.userId,
      action: 'lms.submission.grade',
      entity: 'LmsSubmission',
      entityId: submissionId,
      newValues: { isBackfilled: backfill?.isBackfilled ?? false } as Prisma.InputJsonValue,
    });
    await this.sisPassback.tryPassbackEnrollmentGradeFromGradedSubmission(actor, {
      submissionId,
      studentId: prior.studentId,
      courseInstanceId: prior.assessment.courseInstanceId,
      assessmentId: prior.assessmentId,
      assessmentSettings: prior.assessment.settings,
      assessmentTotalPoints: prior.assessment.totalPoints,
      grade: dto.grade,
    });
    return this.serializeSubmission(row);
  }

  async completeLesson(actor: AuthUser, lessonId: string, dto: CompleteLmsLessonDto) {
    const lesson = await this.repo.findLessonForComplete(
      actor.institutionId,
      lessonId,
      this.scopeEntityId(actor),
    );
    if (!lesson) {
      throw new NotFoundException('Lesson not found');
    }
    await this.studentLmsEligibility.assertStudentEnrolledForCourseInstance(
      actor,
      lesson.module.courseInstanceId,
      this.scopeEntityId(actor),
    );
    const student = await this.repo.findStudent(
      actor.institutionId,
      dto.studentId,
      this.scopeEntityId(actor),
    );
    if (!student) {
      throw new NotFoundException('Student not found');
    }
    this.studentLmsEligibility.assertStudentTargetsSelf(actor, dto.studentId);

    const timeSpent = dto.timeSpent ?? 0;
    const courseInstanceId = lesson.module.courseInstanceId;
    const moduleId = lesson.module.id;

    await this.repo.upsertLessonCompletion({
      lessonId,
      studentId: dto.studentId,
      institutionId: actor.institutionId,
      timeSpent,
    });

    const completedLessonIds = await this.repo.listCompletedLessonIds(
      dto.studentId,
      courseInstanceId,
      actor.institutionId,
    );
    const totalLessons = await this.repo.countPublishedLessons(
      courseInstanceId,
      actor.institutionId,
    );
    const progressPercent =
      totalLessons > 0
        ? Math.min(100, Math.round((completedLessonIds.length / totalLessons) * 10000) / 100)
        : 0;

    const priorProgress = await this.repo.findProgress(
      dto.studentId,
      courseInstanceId,
      actor.institutionId,
    );
    const completedModules = new Set(priorProgress?.completedModules ?? []);
    if (progressPercent >= 100) {
      completedModules.add(moduleId);
    }

    const progress = await this.repo.upsertStudentProgress({
      studentId: dto.studentId,
      courseInstanceId,
      institutionId: actor.institutionId,
      lessonId,
      moduleId,
      progressPercent,
      completedLessons: completedLessonIds,
      completedModules: [...completedModules],
      timeSpent,
    });

    this.audit.append({
      institutionId: actor.institutionId,
      actorId: actor.userId,
      action: 'lms.lesson.complete',
      entity: 'LmsLesson',
      entityId: lessonId,
      newValues: { studentId: dto.studentId, progressPercent } as Prisma.InputJsonValue,
    });

    return {
      lessonId,
      studentId: dto.studentId,
      courseInstanceId,
      progressPercent: Number(progress.progressPercent),
      completedLessons: progress.completedLessons.length,
    };
  }

  async getProgress(actor: AuthUser, courseInstanceId: string, studentId: string) {
    const course = await this.repo.findCourseInstance(
      actor.institutionId,
      courseInstanceId,
      this.scopeEntityId(actor),
    );
    if (!course) {
      throw new NotFoundException('Course instance not found');
    }
    const student = await this.repo.findStudent(
      actor.institutionId,
      studentId,
      this.scopeEntityId(actor),
    );
    if (!student) {
      throw new NotFoundException('Student not found');
    }
    this.studentLmsEligibility.assertStudentTargetsSelf(actor, studentId);
    await this.studentLmsEligibility.assertStudentEnrolledForCourseSection(actor, course.sectionId);
    const progress = await this.repo.findProgress(studentId, courseInstanceId, actor.institutionId);
    if (!progress) {
      return {
        studentId,
        courseInstanceId,
        progressPercent: 0,
        completedLessons: [] as string[],
        completedModules: [] as string[],
        timeSpent: 0,
        lastAccessedAt: null,
      };
    }
    return {
      studentId: progress.studentId,
      courseInstanceId: progress.courseInstanceId,
      progressPercent: Number(progress.progressPercent),
      completedLessons: progress.completedLessons,
      completedModules: progress.completedModules,
      timeSpent: progress.timeSpent,
      lastAccessedAt: progress.lastAccessedAt?.toISOString() ?? null,
    };
  }

  private serializeAssessment(row: {
    id: string;
    courseInstanceId: string;
    title: string;
    type: string;
    instructions: string | null;
    dueDate: Date | null;
    totalPoints: number;
    settings?: unknown;
    createdAt: Date;
    _count: { submissions: number; questions: number };
  }) {
    return {
      id: row.id,
      courseInstanceId: row.courseInstanceId,
      title: row.title,
      type: row.type,
      instructions: row.instructions,
      dueDate: row.dueDate?.toISOString() ?? null,
      totalPoints: row.totalPoints,
      settings: row.settings ?? {},
      submissionCount: row._count.submissions,
      questionCount: row._count.questions,
      createdAt: row.createdAt.toISOString(),
    };
  }

  private serializeAssessmentDetail(
    row: Parameters<LmsAssessmentsService['serializeAssessment']>[0] & {
      settings: unknown;
      rubric: unknown;
      weight: { toNumber?: () => number } | number | string;
      questions: Array<{
        id: string;
        type: string;
        content: unknown;
        points: number;
        sortOrder: number;
      }>;
    },
    revealSolutions: boolean,
  ) {
    return {
      ...this.serializeAssessment(row),
      settings: row.settings,
      rubric: row.rubric,
      weight:
        typeof row.weight === 'object' && row.weight !== null && 'toNumber' in row.weight
          ? Number((row.weight as { toNumber: () => number }).toNumber())
          : Number(row.weight),
      questions: row.questions.map((q) => ({
        id: q.id,
        type: q.type,
        content: revealSolutions ? q.content : this.stripQuestionSolutions(q.content),
        points: q.points,
        sortOrder: q.sortOrder,
      })),
    };
  }

  private stripQuestionSolutions(content: unknown): unknown {
    if (!content || typeof content !== 'object') {
      return content;
    }
    const c = { ...(content as Record<string, unknown>) };
    delete c.correctAnswer;
    delete c.correctOptionIndex;
    return c;
  }

  async createAssessmentQuestion(actor: AuthUser, assessmentId: string, dto: CreateLmsQuestionDto) {
    const assessment = await this.repo.findAssessment(
      actor.institutionId,
      assessmentId,
      this.scopeEntityId(actor),
    );
    if (!assessment) {
      throw new NotFoundException('Assessment not found');
    }
    await this.studentLmsEligibility.assertStudentEnrolledForAssessment(
      actor,
      assessmentId,
      this.scopeEntityId(actor),
    );
    assertValidLmsQuestionContent(dto.type, dto.content);
    const maxAgg = await this.repo.maxQuestionSortOrder(assessmentId, actor.institutionId);
    const nextOrder = (maxAgg._max.sortOrder ?? -1) + 1;
    const sortOrder = dto.sortOrder ?? nextOrder;
    const row = await this.repo.createQuestion({
      assessmentId,
      institutionId: actor.institutionId,
      type: dto.type,
      content: dto.content as Prisma.InputJsonValue,
      points: dto.points ?? 1,
      explanation: dto.explanation?.trim() ?? null,
      tags: (dto.tags ?? []).map((t) => t.trim()).filter(Boolean),
      sortOrder,
    });
    this.audit.append({
      institutionId: actor.institutionId,
      actorId: actor.userId,
      action: 'lms.question.create',
      entity: 'LmsQuestion',
      entityId: row.id,
      newValues: { assessmentId } as Prisma.InputJsonValue,
    });
    return this.serializeQuestionRow(row);
  }

  async updateAssessmentQuestion(actor: AuthUser, questionId: string, dto: UpdateLmsQuestionDto) {
    const prior = await this.repo.findQuestionEntityScoped(
      actor.institutionId,
      questionId,
      this.scopeEntityId(actor),
    );
    if (!prior) {
      throw new NotFoundException('Question not found');
    }
    await this.studentLmsEligibility.assertStudentEnrolledForAssessment(
      actor,
      prior.assessmentId,
      this.scopeEntityId(actor),
    );
    const mergedType = (dto.type ?? prior.type) as LmsQuestionType;
    const mergedContent = (dto.content ?? prior.content ?? {}) as Record<string, unknown>;
    assertValidLmsQuestionContent(mergedType, mergedContent);

    const data: Prisma.LmsQuestionUpdateInput = {};
    if (dto.type !== undefined) data.type = dto.type;
    if (dto.content !== undefined) data.content = dto.content as Prisma.InputJsonValue;
    if (dto.points !== undefined) data.points = dto.points;
    if (dto.explanation !== undefined) data.explanation = dto.explanation;
    if (dto.tags !== undefined) {
      data.tags = dto.tags.map((t) => t.trim()).filter(Boolean);
    }
    if (dto.sortOrder !== undefined) data.sortOrder = dto.sortOrder;

    const updated = await this.repo.updateQuestion(questionId, actor.institutionId, data);
    if (updated.count === 0) {
      throw new NotFoundException('Question not found');
    }
    const fresh = await this.repo.findQuestionEntityScoped(
      actor.institutionId,
      questionId,
      this.scopeEntityId(actor),
    );
    this.audit.append({
      institutionId: actor.institutionId,
      actorId: actor.userId,
      action: 'lms.question.update',
      entity: 'LmsQuestion',
      entityId: questionId,
    });
    return this.serializeQuestionRow(fresh!);
  }

  async removeAssessmentQuestion(actor: AuthUser, questionId: string) {
    const q = await this.repo.findQuestionScoped(
      actor.institutionId,
      questionId,
      this.scopeEntityId(actor),
    );
    if (!q) {
      throw new NotFoundException('Question not found');
    }
    await this.studentLmsEligibility.assertStudentEnrolledForAssessment(
      actor,
      q.assessmentId,
      this.scopeEntityId(actor),
    );
    const r = await this.repo.deleteQuestion(questionId, actor.institutionId);
    if (r.count === 0) {
      throw new NotFoundException('Question not found');
    }
    this.audit.append({
      institutionId: actor.institutionId,
      actorId: actor.userId,
      action: 'lms.question.delete',
      entity: 'LmsQuestion',
      entityId: questionId,
    });
    return { deleted: true as const };
  }

  async importAssessmentQuestionsFromBank(
    actor: AuthUser,
    assessmentId: string,
    dto: ImportBankItemsToAssessmentDto,
  ) {
    const assessment = await this.repo.findAssessment(
      actor.institutionId,
      assessmentId,
      this.scopeEntityId(actor),
    );
    if (!assessment) {
      throw new NotFoundException('Assessment not found');
    }
    await this.studentLmsEligibility.assertStudentEnrolledForAssessment(
      actor,
      assessmentId,
      this.scopeEntityId(actor),
    );
    const items = await this.bankRepo.findItemsByIds(actor.institutionId, dto.bankItemIds);
    if (items.length !== dto.bankItemIds.length) {
      throw new NotFoundException('One or more bank items were not found in this institution');
    }
    const byId = new Map(items.map((i) => [i.id, i]));
    const ordered = dto.bankItemIds.map((id) => byId.get(id)).filter(Boolean) as typeof items;
    const maxAgg = await this.repo.maxQuestionSortOrder(assessmentId, actor.institutionId);
    let ord = maxAgg._max.sortOrder ?? -1;
    const questionIds: string[] = [];
    for (const src of ordered) {
      ord += 1;
      const row = await this.repo.createQuestion({
        assessmentId,
        institutionId: actor.institutionId,
        type: src.type,
        content: src.content as Prisma.InputJsonValue,
        points: src.points,
        explanation: src.explanation,
        tags: [...src.tags],
        sortOrder: ord,
      });
      questionIds.push(row.id);
    }
    this.audit.append({
      institutionId: actor.institutionId,
      actorId: actor.userId,
      action: 'lms.question.importFromBank',
      entity: 'LmsAssessment',
      entityId: assessmentId,
      newValues: {
        count: questionIds.length,
        bankItemIds: dto.bankItemIds,
      } as Prisma.InputJsonValue,
    });
    return { imported: questionIds.length, questionIds };
  }

  private serializeQuestionRow(row: {
    id: string;
    type: string;
    content: unknown;
    points: number;
    sortOrder: number;
    explanation?: string | null;
    tags?: string[];
  }) {
    return {
      id: row.id,
      type: row.type,
      content: row.content,
      points: row.points,
      sortOrder: row.sortOrder,
      explanation: row.explanation ?? null,
      tags: row.tags ?? [],
    };
  }

  private serializeQuizAttempt(
    row: {
      id: string;
      assessmentId: string;
      studentId: string;
      status: string;
      attemptNumber: number;
      startedAt: Date | null;
      expiresAt: Date | null;
      answers: unknown;
      assessment?: {
        title: string;
        type: string;
        questions: Array<{
          id: string;
          type: string;
          content: unknown;
          points: number;
          sortOrder: number;
        }>;
      };
    },
    assessment: { settings: unknown; title: string; type: string },
    quiz: ReturnType<typeof readLmsQuizSettings>,
  ) {
    let questions =
      row.assessment?.questions.map((q) => ({
        id: q.id,
        type: q.type,
        content: this.stripQuestionSolutions(q.content),
        points: q.points,
        sortOrder: q.sortOrder,
      })) ?? [];

    if (quiz.shuffleQuestions) {
      questions = [...questions].sort(() => Math.random() - 0.5);
    }

    return {
      submissionId: row.id,
      assessmentId: row.assessmentId,
      studentId: row.studentId,
      status: row.status,
      attemptNumber: row.attemptNumber,
      startedAt: row.startedAt?.toISOString() ?? null,
      expiresAt: row.expiresAt?.toISOString() ?? null,
      serverNow: new Date().toISOString(),
      timeLimitMinutes: quiz.timeLimitMinutes,
      maxAttempts: quiz.maxAttempts,
      autoGradeMcq: quiz.autoGradeMcq,
      assessmentTitle: assessment.title,
      assessmentType: assessment.type,
      questions,
      answers: row.answers,
    };
  }

  private serializeSubmission(row: {
    id: string;
    assessmentId: string;
    studentId: string;
    status: string;
    attemptNumber?: number;
    startedAt?: Date | null;
    expiresAt?: Date | null;
    submittedAt: Date | null;
    gradedAt: Date | null;
    feedback: string | null;
    grade: unknown;
    answers: unknown;
    student: { studentNumber: string };
    assessment?: { title: string };
  }) {
    return {
      id: row.id,
      assessmentId: row.assessmentId,
      studentId: row.studentId,
      studentNumber: row.student.studentNumber,
      status: row.status,
      attemptNumber: row.attemptNumber ?? 1,
      startedAt: row.startedAt?.toISOString() ?? null,
      expiresAt: row.expiresAt?.toISOString() ?? null,
      submittedAt: row.submittedAt?.toISOString() ?? null,
      gradedAt: row.gradedAt?.toISOString() ?? null,
      feedback: row.feedback,
      grade: row.grade,
      answers: row.answers,
      assessmentTitle: row.assessment?.title,
    };
  }
}
