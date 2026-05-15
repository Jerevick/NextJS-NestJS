import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { LmsSubmissionStatus, Prisma } from '@prisma/client';
import type { AuthUser } from '../auth/auth.types';
import { AuditService } from '../audit/audit.service';
import type { StudentRecordBackfillContext } from '../common/record-posting/student-record-backfill.context';
import type { CreateLmsAssessmentDto } from './dto/create-lms-assessment.dto';
import type { CreateLmsSubmissionDto } from './dto/create-lms-submission.dto';
import type { GradeLmsSubmissionDto } from './dto/grade-lms-submission.dto';
import type { SubmitLmsSubmissionDto } from './dto/submit-lms-submission.dto';
import type { UpdateLmsAssessmentDto } from './dto/update-lms-assessment.dto';
import type { CompleteLmsLessonDto } from './dto/complete-lms-lesson.dto';
import { LmsAssessmentsRepository } from './lms-assessments.repository';

@Injectable()
export class LmsAssessmentsService {
  constructor(
    private readonly repo: LmsAssessmentsRepository,
    private readonly audit: AuditService,
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
    const rows = await this.repo.listAssessments(actor.institutionId, courseInstanceId);
    return { data: rows.map((r) => this.serializeAssessment(r)) };
  }

  async getAssessment(actor: AuthUser, id: string) {
    const row = await this.repo.findAssessment(actor.institutionId, id, this.scopeEntityId(actor));
    if (!row) {
      throw new NotFoundException('Assessment not found');
    }
    return this.serializeAssessmentDetail(row);
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
    const prior = await this.repo.findAssessment(actor.institutionId, id, this.scopeEntityId(actor));
    if (!prior) {
      throw new NotFoundException('Assessment not found');
    }
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
    const prior = await this.repo.findAssessment(actor.institutionId, id, this.scopeEntityId(actor));
    if (!prior) {
      throw new NotFoundException('Assessment not found');
    }
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
    const rows = await this.repo.listSubmissions(actor.institutionId, assessmentId);
    return { data: rows.map((r) => this.serializeSubmission(r)) };
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
    if (existing) {
      throw new ConflictException('Submission already exists for this student');
    }
    const row = await this.repo.createSubmission({
      assessmentId,
      studentId: dto.studentId,
      institutionId: actor.institutionId,
      answers: (dto.answers ?? {}) as Prisma.InputJsonValue,
      status: LmsSubmissionStatus.DRAFT,
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
    if (prior.status !== LmsSubmissionStatus.DRAFT && prior.status !== LmsSubmissionStatus.RETURNED) {
      throw new BadRequestException('Only draft or returned submissions can be submitted');
    }
    const isLate =
      prior.assessment.dueDate !== null &&
      prior.assessment.dueDate !== undefined &&
      new Date() > prior.assessment.dueDate;
    const answers = (dto.answers ?? prior.answers) as Prisma.InputJsonValue;
    const row = await this.repo.updateSubmission(submissionId, {
      answers,
      status: isLate ? LmsSubmissionStatus.LATE : LmsSubmissionStatus.SUBMITTED,
      submittedAt: new Date(),
    });
    this.audit.append({
      institutionId: actor.institutionId,
      actorId: actor.userId,
      action: 'lms.submission.submit',
      entity: 'LmsSubmission',
      entityId: submissionId,
      newValues: { isBackfilled: backfill?.isBackfilled ?? false } as Prisma.InputJsonValue,
    });
    return this.serializeSubmission(row);
  }

  async gradeSubmission(
    actor: AuthUser,
    submissionId: string,
    dto: GradeLmsSubmissionDto,
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
    const row = await this.repo.updateSubmission(submissionId, {
      grade: dto.grade as Prisma.InputJsonValue,
      feedback: dto.feedback?.trim() ?? null,
      status: LmsSubmissionStatus.GRADED,
      gradedById: actor.userId,
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
    const student = await this.repo.findStudent(
      actor.institutionId,
      dto.studentId,
      this.scopeEntityId(actor),
    );
    if (!student) {
      throw new NotFoundException('Student not found');
    }

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
    const totalLessons = await this.repo.countPublishedLessons(courseInstanceId, actor.institutionId);
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
  ) {
    return {
      ...this.serializeAssessment(row),
      settings: row.settings,
      rubric: row.rubric,
      weight: typeof row.weight === 'object' && row.weight !== null && 'toNumber' in row.weight
        ? Number((row.weight as { toNumber: () => number }).toNumber())
        : Number(row.weight),
      questions: row.questions.map((q) => ({
        id: q.id,
        type: q.type,
        content: q.content,
        points: q.points,
        sortOrder: q.sortOrder,
      })),
    };
  }

  private serializeSubmission(row: {
    id: string;
    assessmentId: string;
    studentId: string;
    status: string;
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
      submittedAt: row.submittedAt?.toISOString() ?? null,
      gradedAt: row.gradedAt?.toISOString() ?? null,
      feedback: row.feedback,
      grade: row.grade,
      answers: row.answers,
      assessmentTitle: row.assessment?.title,
    };
  }
}
