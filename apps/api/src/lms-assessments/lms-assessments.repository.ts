import { Injectable } from '@nestjs/common';
import type { LmsAssessmentType, LmsSubmissionStatus, Prisma } from '@prisma/client';
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
        ...(scopeEntityId
          ? { section: { is: { entityId: scopeEntityId, deletedAt: null } } }
          : {}),
      },
      select: { id: true },
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
        ...(scopeEntityId
          ? { student: { entityId: scopeEntityId, deletedAt: null } }
          : {}),
      },
      include: {
        assessment: {
          select: { id: true, title: true, totalPoints: true, courseInstanceId: true, dueDate: true },
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
    });
  }

  createSubmission(data: {
    assessmentId: string;
    studentId: string;
    institutionId: string;
    answers: Prisma.InputJsonValue;
    status: LmsSubmissionStatus;
  }) {
    return this.prisma.lmsSubmission.create({
      data,
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
}
