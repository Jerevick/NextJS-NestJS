import { Injectable } from '@nestjs/common';
import type {
  LmsAssessmentType,
  LmsQuestionType,
  LmsSubmissionStatus,
  Prisma,
} from '@prisma/client';
import { EnrollmentRowStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const assessmentInclude = {
  courseInstance: {
    select: {
      id: true,
      section: { select: { id: true, entityId: true } },
    },
  },
  _count: { select: { submissions: true, questions: true } },
} as const;

@Injectable()
export class LmsAssessmentsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findCourseInstance(institutionId: string, courseInstanceId: string, scopeEntityId?: string) {
    return this.prisma.lmsCourseInstance.findFirst({
      where: {
        id: courseInstanceId,
        institutionId,
        deletedAt: null,
        ...(scopeEntityId ? { section: { is: { entityId: scopeEntityId, deletedAt: null } } } : {}),
      },
      select: { id: true, sectionId: true },
    });
  }

  listAssessments(institutionId: string, courseInstanceId: string) {
    return this.prisma.lmsAssessment.findMany({
      where: { institutionId, courseInstanceId, deletedAt: null },
      orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }],
      include: assessmentInclude,
    });
  }

  findAssessment(institutionId: string, id: string, scopeEntityId?: string) {
    return this.prisma.lmsAssessment.findFirst({
      where: {
        id,
        institutionId,
        deletedAt: null,
        ...(scopeEntityId
          ? {
              courseInstance: {
                section: { entityId: scopeEntityId, deletedAt: null },
              },
            }
          : {}),
      },
      include: {
        ...assessmentInclude,
        questions: { orderBy: { sortOrder: 'asc' } },
      },
    });
  }

  createAssessment(data: {
    courseInstanceId: string;
    institutionId: string;
    title: string;
    type: LmsAssessmentType;
    instructions?: string | null;
    dueDate?: Date | null;
    totalPoints: number;
    settings: Prisma.InputJsonValue;
    rubric: Prisma.InputJsonValue;
  }) {
    return this.prisma.lmsAssessment.create({
      data,
      include: assessmentInclude,
    });
  }

  updateAssessment(
    id: string,
    institutionId: string,
    data: Prisma.LmsAssessmentUpdateInput,
  ): Promise<Prisma.BatchPayload> {
    return this.prisma.lmsAssessment.updateMany({
      where: { id, institutionId, deletedAt: null },
      data,
    });
  }

  softDeleteAssessment(id: string, institutionId: string, at: Date): Promise<Prisma.BatchPayload> {
    return this.prisma.lmsAssessment.updateMany({
      where: { id, institutionId, deletedAt: null },
      data: { deletedAt: at },
    });
  }

  findStudent(institutionId: string, studentId: string, scopeEntityId?: string) {
    return this.prisma.student.findFirst({
      where: {
        id: studentId,
        institutionId,
        deletedAt: null,
        ...(scopeEntityId ? { entityId: scopeEntityId } : {}),
      },
      select: { id: true },
    });
  }

  findSubmission(institutionId: string, id: string, scopeEntityId?: string) {
    return this.prisma.lmsSubmission.findFirst({
      where: {
        id,
        institutionId,
        ...(scopeEntityId ? { student: { entityId: scopeEntityId, deletedAt: null } } : {}),
      },
      include: {
        assessment: {
          select: {
            id: true,
            title: true,
            type: true,
            totalPoints: true,
            courseInstanceId: true,
            dueDate: true,
            settings: true,
          },
        },
        student: { select: { id: true, studentNumber: true } },
      },
    });
  }

  listSubmissions(institutionId: string, assessmentId: string) {
    return this.prisma.lmsSubmission.findMany({
      where: { institutionId, assessmentId },
      orderBy: { updatedAt: 'desc' },
      include: {
        student: { select: { id: true, studentNumber: true } },
      },
    });
  }

  findSubmissionForStudent(institutionId: string, assessmentId: string, studentId: string) {
    return this.prisma.lmsSubmission.findFirst({
      where: { institutionId, assessmentId, studentId },
      orderBy: { attemptNumber: 'desc' },
    });
  }

  countSubmissionsForStudent(institutionId: string, assessmentId: string, studentId: string) {
    return this.prisma.lmsSubmission.count({
      where: { institutionId, assessmentId, studentId },
    });
  }

  findActiveDraftAttempt(institutionId: string, assessmentId: string, studentId: string) {
    return this.prisma.lmsSubmission.findFirst({
      where: {
        institutionId,
        assessmentId,
        studentId,
        status: 'DRAFT',
      },
      orderBy: { attemptNumber: 'desc' },
      include: {
        assessment: {
          include: {
            questions: { orderBy: { sortOrder: 'asc' } },
          },
        },
      },
    });
  }

  createSubmission(data: {
    assessmentId: string;
    studentId: string;
    institutionId: string;
    answers: Prisma.InputJsonValue;
    status: LmsSubmissionStatus;
    attemptNumber: number;
    startedAt?: Date;
    expiresAt?: Date | null;
  }) {
    return this.prisma.lmsSubmission.create({
      data: {
        assessmentId: data.assessmentId,
        studentId: data.studentId,
        institutionId: data.institutionId,
        answers: data.answers,
        status: data.status,
        attemptNumber: data.attemptNumber,
        startedAt: data.startedAt,
        expiresAt: data.expiresAt,
      },
      include: {
        student: { select: { id: true, studentNumber: true } },
        assessment: { select: { id: true, title: true } },
      },
    });
  }

  updateSubmission(id: string, data: Prisma.LmsSubmissionUpdateInput) {
    return this.prisma.lmsSubmission.update({
      where: { id },
      data,
      include: {
        student: { select: { id: true, studentNumber: true } },
        assessment: { select: { id: true, title: true } },
      },
    });
  }

  countPublishedLessons(courseInstanceId: string, institutionId: string): Promise<number> {
    return this.prisma.lmsLesson.count({
      where: {
        institutionId,
        deletedAt: null,
        isPublished: true,
        module: { courseInstanceId, deletedAt: null },
      },
    });
  }

  findLessonForComplete(institutionId: string, lessonId: string, scopeEntityId?: string) {
    return this.prisma.lmsLesson.findFirst({
      where: {
        id: lessonId,
        institutionId,
        deletedAt: null,
        ...(scopeEntityId
          ? {
              module: {
                courseInstance: {
                  section: { entityId: scopeEntityId, deletedAt: null },
                },
              },
            }
          : {}),
      },
      include: {
        module: { select: { id: true, courseInstanceId: true } },
      },
    });
  }

  upsertLessonCompletion(data: {
    lessonId: string;
    studentId: string;
    institutionId: string;
    timeSpent: number;
  }) {
    return this.prisma.lmsLessonCompletion.upsert({
      where: { lessonId_studentId: { lessonId: data.lessonId, studentId: data.studentId } },
      create: {
        lessonId: data.lessonId,
        studentId: data.studentId,
        institutionId: data.institutionId,
        timeSpent: data.timeSpent,
      },
      update: { timeSpent: { increment: data.timeSpent }, completedAt: new Date() },
    });
  }

  upsertStudentProgress(data: {
    studentId: string;
    courseInstanceId: string;
    institutionId: string;
    lessonId: string;
    moduleId: string;
    progressPercent: number;
    completedLessons: string[];
    completedModules: string[];
    timeSpent: number;
  }) {
    return this.prisma.lmsStudentProgress.upsert({
      where: {
        studentId_courseInstanceId: {
          studentId: data.studentId,
          courseInstanceId: data.courseInstanceId,
        },
      },
      create: {
        studentId: data.studentId,
        courseInstanceId: data.courseInstanceId,
        institutionId: data.institutionId,
        completedLessons: data.completedLessons,
        completedModules: data.completedModules,
        progressPercent: data.progressPercent,
        timeSpent: data.timeSpent,
        lastAccessedAt: new Date(),
      },
      update: {
        completedLessons: data.completedLessons,
        completedModules: data.completedModules,
        progressPercent: data.progressPercent,
        timeSpent: { increment: data.timeSpent },
        lastAccessedAt: new Date(),
      },
    });
  }

  countCompletedLessonsForCourse(
    studentId: string,
    courseInstanceId: string,
    institutionId: string,
  ): Promise<number> {
    return this.prisma.lmsLessonCompletion.count({
      where: {
        studentId,
        institutionId,
        lesson: {
          deletedAt: null,
          module: { courseInstanceId, deletedAt: null },
        },
      },
    });
  }

  listCompletedLessonIds(
    studentId: string,
    courseInstanceId: string,
    institutionId: string,
  ): Promise<string[]> {
    return this.prisma.lmsLessonCompletion
      .findMany({
        where: {
          studentId,
          institutionId,
          lesson: { module: { courseInstanceId } },
        },
        select: { lessonId: true },
      })
      .then((rows) => rows.map((r) => r.lessonId));
  }

  findProgress(studentId: string, courseInstanceId: string, institutionId: string) {
    return this.prisma.lmsStudentProgress.findUnique({
      where: {
        studentId_courseInstanceId: { studentId, courseInstanceId },
      },
    });
  }

  maxQuestionSortOrder(assessmentId: string, institutionId: string) {
    return this.prisma.lmsQuestion.aggregate({
      where: { assessmentId, institutionId },
      _max: { sortOrder: true },
    });
  }

  createQuestion(data: {
    assessmentId: string;
    institutionId: string;
    type: LmsQuestionType;
    content: Prisma.InputJsonValue;
    points: number;
    explanation?: string | null;
    tags: string[];
    sortOrder: number;
  }) {
    return this.prisma.lmsQuestion.create({
      data: {
        assessmentId: data.assessmentId,
        institutionId: data.institutionId,
        type: data.type,
        content: data.content,
        points: data.points,
        explanation: data.explanation ?? null,
        tags: data.tags,
        sortOrder: data.sortOrder,
      },
    });
  }

  findQuestionScoped(institutionId: string, questionId: string, scopeEntityId?: string) {
    return this.prisma.lmsQuestion.findFirst({
      where: {
        id: questionId,
        institutionId,
        ...(scopeEntityId
          ? {
              assessment: {
                courseInstance: {
                  section: { entityId: scopeEntityId, deletedAt: null },
                },
              },
            }
          : {}),
      },
      select: {
        id: true,
        assessmentId: true,
        institutionId: true,
      },
    });
  }

  findQuestionEntityScoped(institutionId: string, questionId: string, scopeEntityId?: string) {
    return this.prisma.lmsQuestion.findFirst({
      where: {
        id: questionId,
        institutionId,
        ...(scopeEntityId
          ? {
              assessment: {
                courseInstance: {
                  section: { entityId: scopeEntityId, deletedAt: null },
                },
              },
            }
          : {}),
      },
      select: {
        id: true,
        assessmentId: true,
        type: true,
        content: true,
        points: true,
        sortOrder: true,
        explanation: true,
        tags: true,
      },
    });
  }

  updateQuestion(
    id: string,
    institutionId: string,
    data: Prisma.LmsQuestionUpdateInput,
  ): Promise<Prisma.BatchPayload> {
    return this.prisma.lmsQuestion.updateMany({
      where: { id, institutionId },
      data,
    });
  }

  deleteQuestion(id: string, institutionId: string): Promise<Prisma.BatchPayload> {
    return this.prisma.lmsQuestion.deleteMany({
      where: { id, institutionId },
    });
  }

  listTeacherRoster(institutionId: string, sectionId: string, scopeEntityId?: string) {
    return this.prisma.studentEnrollment.findMany({
      where: {
        institutionId,
        sectionId,
        deletedAt: null,
        status: { in: [EnrollmentRowStatus.ENROLLED, EnrollmentRowStatus.COMPLETED] },
        ...(scopeEntityId ? { student: { entityId: scopeEntityId, deletedAt: null } } : {}),
      },
      select: {
        id: true,
        studentId: true,
        status: true,
        student: {
          select: {
            studentNumber: true,
            user: { select: { email: true } },
          },
        },
      },
      orderBy: { student: { studentNumber: 'asc' } },
    });
  }

  listSubmissionsForTeacherGradebook(institutionId: string, courseInstanceId: string) {
    return this.prisma.lmsSubmission.findMany({
      where: {
        institutionId,
        assessment: {
          courseInstanceId,
          institutionId,
          deletedAt: null,
        },
      },
      select: {
        id: true,
        assessmentId: true,
        studentId: true,
        status: true,
        attemptNumber: true,
        grade: true,
        submittedAt: true,
        assessment: { select: { totalPoints: true, title: true } },
      },
      orderBy: [{ assessmentId: 'asc' }, { studentId: 'asc' }, { attemptNumber: 'desc' }],
    });
  }

  listPublishedLessonMetaForCourse(institutionId: string, courseInstanceId: string) {
    return this.prisma.lmsLesson.findMany({
      where: {
        institutionId,
        deletedAt: null,
        isPublished: true,
        module: {
          institutionId,
          deletedAt: null,
          courseInstanceId,
        },
      },
      select: {
        id: true,
        title: true,
        sortOrder: true,
        module: { select: { title: true, sortOrder: true } },
      },
      orderBy: [{ module: { sortOrder: 'asc' } }, { sortOrder: 'asc' }],
    });
  }

  countLessonCompletionsGrouped(institutionId: string, lessonIds: string[]) {
    if (lessonIds.length === 0) {
      return Promise.resolve([]);
    }
    return this.prisma.lmsLessonCompletion.groupBy({
      by: ['lessonId'],
      where: { institutionId, lessonId: { in: lessonIds } },
      _count: { _all: true },
    });
  }
}
