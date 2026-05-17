import { Injectable } from '@nestjs/common';
import {
  EnrollmentRowStatus,
  type LmsLesson,
  type LmsLessonType,
  type LmsModule,
  type Prisma,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const courseInstanceInclude = {
  section: {
    include: {
      course: { select: { id: true, code: true, title: true } },
      semester: { select: { id: true, name: true } },
      instructor: { select: { id: true, email: true, profile: true } },
    },
  },
} as const;

const activeLessonResources: Prisma.LmsLesson$resourcesArgs = {
  where: { deletedAt: null },
  orderBy: { createdAt: 'asc' },
};

@Injectable()
export class LmsRepository {
  constructor(private readonly prisma: PrismaService) {}

  private buildCourseInstanceListWhere(
    institutionId: string,
    opts: { sectionId?: string; scopeEntityId?: string; enrolledStudentId?: string },
  ): Prisma.LmsCourseInstanceWhereInput {
    const enrollmentFilter =
      opts.enrolledStudentId !== undefined && opts.enrolledStudentId !== ''
        ? {
            some: {
              studentId: opts.enrolledStudentId,
              institutionId,
              deletedAt: null,
              status: { in: [EnrollmentRowStatus.ENROLLED, EnrollmentRowStatus.COMPLETED] },
            },
          }
        : undefined;

    const sectionNested: Prisma.SectionWhereInput | undefined =
      opts.scopeEntityId !== undefined || enrollmentFilter !== undefined
        ? {
            deletedAt: null,
            ...(opts.scopeEntityId ? { entityId: opts.scopeEntityId } : {}),
            ...(enrollmentFilter ? { enrollments: enrollmentFilter } : {}),
          }
        : undefined;

    return {
      institutionId,
      deletedAt: null,
      ...(opts.sectionId ? { sectionId: opts.sectionId } : {}),
      ...(sectionNested !== undefined ? { section: { is: sectionNested } } : {}),
    };
  }

  findSectionInInstitution(
    institutionId: string,
    sectionId: string,
    scopeEntityId?: string,
  ): Promise<{ id: string } | null> {
    return this.prisma.section.findFirst({
      where: {
        id: sectionId,
        institutionId,
        deletedAt: null,
        ...(scopeEntityId ? { entityId: scopeEntityId } : {}),
      },
      select: { id: true },
    });
  }

  findCourseInstanceById(institutionId: string, id: string, scopeEntityId?: string) {
    return this.prisma.lmsCourseInstance.findFirst({
      where: {
        id,
        institutionId,
        deletedAt: null,
        ...(scopeEntityId ? { section: { is: { entityId: scopeEntityId, deletedAt: null } } } : {}),
      },
      include: {
        ...courseInstanceInclude,
        modules: {
          where: { deletedAt: null },
          orderBy: { sortOrder: 'asc' as const },
          include: {
            lessons: {
              where: { deletedAt: null },
              orderBy: { sortOrder: 'asc' as const },
              include: { resources: activeLessonResources },
            },
          },
        },
      },
    });
  }

  findCourseInstanceBySection(
    institutionId: string,
    sectionId: string,
    scopeEntityId?: string,
  ): Promise<Prisma.LmsCourseInstanceGetPayload<{ include: typeof courseInstanceInclude }> | null> {
    return this.prisma.lmsCourseInstance.findFirst({
      where: {
        sectionId,
        institutionId,
        deletedAt: null,
        ...(scopeEntityId ? { section: { is: { entityId: scopeEntityId, deletedAt: null } } } : {}),
      },
      include: courseInstanceInclude,
    });
  }

  listCourseInstances(
    institutionId: string,
    args: {
      sectionId?: string;
      take: number;
      cursor?: string;
      scopeEntityId?: string;
      enrolledStudentId?: string;
    },
  ): Promise<Prisma.LmsCourseInstanceGetPayload<{ include: typeof courseInstanceInclude }>[]> {
    const where = this.buildCourseInstanceListWhere(institutionId, {
      sectionId: args.sectionId,
      scopeEntityId: args.scopeEntityId,
      enrolledStudentId: args.enrolledStudentId,
    });
    return this.prisma.lmsCourseInstance.findMany({
      where,
      take: args.take + 1,
      ...(args.cursor ? { skip: 1, cursor: { id: args.cursor } } : {}),
      orderBy: { id: 'asc' },
      include: courseInstanceInclude,
    });
  }

  countCourseInstances(
    institutionId: string,
    sectionId?: string,
    scopeEntityId?: string,
    enrolledStudentId?: string,
  ): Promise<number> {
    const where = this.buildCourseInstanceListWhere(institutionId, {
      sectionId,
      scopeEntityId,
      enrolledStudentId,
    });
    return this.prisma.lmsCourseInstance.count({
      where,
    });
  }

  touchStudentProgressLastAccessed(
    institutionId: string,
    studentId: string,
    courseInstanceId: string,
  ) {
    return this.prisma.lmsStudentProgress.upsert({
      where: {
        studentId_courseInstanceId: { studentId, courseInstanceId },
      },
      create: {
        studentId,
        courseInstanceId,
        institutionId,
        completedLessons: [],
        completedModules: [],
        progressPercent: 0,
        timeSpent: 0,
        lastAccessedAt: new Date(),
      },
      update: {
        lastAccessedAt: new Date(),
      },
    });
  }

  listStudentProgressByCourses(
    institutionId: string,
    studentId: string,
    courseInstanceIds: string[],
  ) {
    if (courseInstanceIds.length === 0) {
      return Promise.resolve(
        [] as {
          courseInstanceId: string;
          progressPercent: unknown;
          lastAccessedAt: Date | null;
          completedLessons: string[];
        }[],
      );
    }
    return this.prisma.lmsStudentProgress.findMany({
      where: {
        institutionId,
        studentId,
        courseInstanceId: { in: courseInstanceIds },
      },
      select: {
        courseInstanceId: true,
        progressPercent: true,
        lastAccessedAt: true,
        completedLessons: true,
      },
    });
  }

  /** Published lessons per course, ordered module `sortOrder` then lesson `sortOrder`. */
  listPublishedLessonIdsInSyllabusOrder(
    institutionId: string,
    courseInstanceIds: string[],
  ): Promise<Map<string, string[]>> {
    if (courseInstanceIds.length === 0) {
      return Promise.resolve(new Map());
    }
    return this.prisma.lmsLesson
      .findMany({
        where: {
          institutionId,
          deletedAt: null,
          isPublished: true,
          module: {
            institutionId,
            deletedAt: null,
            courseInstanceId: { in: courseInstanceIds },
          },
        },
        select: {
          id: true,
          sortOrder: true,
          module: {
            select: {
              courseInstanceId: true,
              sortOrder: true,
            },
          },
        },
      })
      .then((rows) => {
        const byCourse = new Map<string, typeof rows>();
        for (const r of rows) {
          const cid = r.module.courseInstanceId;
          const list = byCourse.get(cid) ?? [];
          list.push(r);
          byCourse.set(cid, list);
        }
        const out = new Map<string, string[]>();
        for (const [cid, list] of byCourse) {
          list.sort((a, b) => {
            const mo = a.module.sortOrder - b.module.sortOrder;
            if (mo !== 0) {
              return mo;
            }
            return a.sortOrder - b.sortOrder;
          });
          out.set(
            cid,
            list.map((l) => l.id),
          );
        }
        return out;
      });
  }

  /**
   * Counts assessments due within the horizon that the student has not yet submitted in a terminal state.
   */
  async countDueSoonOpenAssessmentsByCourse(
    institutionId: string,
    studentId: string,
    courseInstanceIds: string[],
    horizonDays: number,
  ): Promise<Map<string, number>> {
    const out = new Map<string, number>();
    if (courseInstanceIds.length === 0) {
      return out;
    }
    for (const id of courseInstanceIds) {
      out.set(id, 0);
    }

    const now = new Date();
    const horizonEnd = new Date(now.getTime() + horizonDays * 86_400_000);

    const assessments = await this.prisma.lmsAssessment.findMany({
      where: {
        institutionId,
        deletedAt: null,
        courseInstanceId: { in: courseInstanceIds },
        dueDate: { gte: now, lte: horizonEnd },
      },
      select: { id: true, courseInstanceId: true },
    });
    if (assessments.length === 0) {
      return out;
    }

    const assessmentIds = assessments.map((a) => a.id);
    const terminal = await this.prisma.lmsSubmission.findMany({
      where: {
        institutionId,
        studentId,
        assessmentId: { in: assessmentIds },
        status: { in: ['SUBMITTED', 'LATE', 'GRADED'] },
      },
      select: { assessmentId: true },
    });
    const doneIds = new Set(terminal.map((t) => t.assessmentId));

    for (const a of assessments) {
      if (doneIds.has(a.id)) {
        continue;
      }
      out.set(a.courseInstanceId, (out.get(a.courseInstanceId) ?? 0) + 1);
    }
    return out;
  }

  createCourseInstance(data: {
    sectionId: string;
    institutionId: string;
    welcomeMessage?: string | null;
    coverImage?: string | null;
    settings?: Prisma.InputJsonValue;
  }): Promise<Prisma.LmsCourseInstanceGetPayload<{ include: typeof courseInstanceInclude }>> {
    return this.prisma.lmsCourseInstance.create({
      data: {
        sectionId: data.sectionId,
        institutionId: data.institutionId,
        welcomeMessage: data.welcomeMessage ?? null,
        coverImage: data.coverImage ?? null,
        settings: data.settings ?? {},
      },
      include: courseInstanceInclude,
    });
  }

  updateCourseInstance(
    id: string,
    institutionId: string,
    data: Prisma.LmsCourseInstanceUpdateInput,
  ): Promise<Prisma.BatchPayload> {
    return this.prisma.lmsCourseInstance.updateMany({
      where: { id, institutionId, deletedAt: null },
      data,
    });
  }

  softDeleteCourseInstance(
    id: string,
    institutionId: string,
    at: Date,
  ): Promise<Prisma.BatchPayload> {
    return this.prisma.lmsCourseInstance.updateMany({
      where: { id, institutionId, deletedAt: null },
      data: { deletedAt: at },
    });
  }

  findContentModule(
    institutionId: string,
    moduleId: string,
  ): Promise<Prisma.LmsModuleGetPayload<{
    include: { courseInstance: { select: { id: true; institutionId: true } } };
  }> | null> {
    return this.prisma.lmsModule.findFirst({
      where: { id: moduleId, institutionId, deletedAt: null },
      include: { courseInstance: { select: { id: true, institutionId: true } } },
    });
  }

  listModulesForCourseInstance(
    institutionId: string,
    courseInstanceId: string,
  ): Promise<
    Prisma.LmsModuleGetPayload<{
      include: { lessons: { include: { resources: typeof activeLessonResources } } };
    }>[]
  > {
    return this.prisma.lmsModule.findMany({
      where: { courseInstanceId, institutionId, deletedAt: null },
      orderBy: { sortOrder: 'asc' },
      include: {
        lessons: {
          where: { deletedAt: null },
          orderBy: { sortOrder: 'asc' },
          include: { resources: activeLessonResources },
        },
      },
    });
  }

  createContentModule(data: {
    courseInstanceId: string;
    institutionId: string;
    title: string;
    sortOrder: number;
    isPublished: boolean;
    unlockCondition: Prisma.InputJsonValue;
  }): Promise<LmsModule> {
    return this.prisma.lmsModule.create({
      data: {
        courseInstanceId: data.courseInstanceId,
        institutionId: data.institutionId,
        title: data.title,
        sortOrder: data.sortOrder,
        isPublished: data.isPublished,
        unlockCondition: data.unlockCondition,
      },
    });
  }

  updateContentModule(
    id: string,
    institutionId: string,
    data: Prisma.LmsModuleUpdateInput,
  ): Promise<Prisma.BatchPayload> {
    return this.prisma.lmsModule.updateMany({
      where: { id, institutionId, deletedAt: null },
      data,
    });
  }

  softDeleteContentModule(
    id: string,
    institutionId: string,
    at: Date,
  ): Promise<Prisma.BatchPayload> {
    return this.prisma.lmsModule.updateMany({
      where: { id, institutionId, deletedAt: null },
      data: { deletedAt: at },
    });
  }

  maxModuleSortOrder(
    courseInstanceId: string,
    institutionId: string,
  ): Promise<{ _max: { sortOrder: number | null } }> {
    return this.prisma.lmsModule.aggregate({
      where: { courseInstanceId, institutionId, deletedAt: null },
      _max: { sortOrder: true },
    });
  }

  findLesson(institutionId: string, lessonId: string) {
    return this.prisma.lmsLesson.findFirst({
      where: { id: lessonId, institutionId, deletedAt: null },
      include: { module: { select: { id: true, institutionId: true, courseInstanceId: true } } },
    });
  }

  listLessonsForModule(
    institutionId: string,
    moduleId: string,
  ): Promise<
    Prisma.LmsLessonGetPayload<{ include: { resources: typeof activeLessonResources } }>[]
  > {
    return this.prisma.lmsLesson.findMany({
      where: { moduleId, institutionId, deletedAt: null },
      orderBy: { sortOrder: 'asc' },
      include: { resources: activeLessonResources },
    });
  }

  createLesson(data: {
    moduleId: string;
    institutionId: string;
    title: string;
    type: LmsLessonType;
    content: Prisma.InputJsonValue;
    duration: number | null;
    sortOrder: number;
    isPublished: boolean;
  }): Promise<LmsLesson> {
    return this.prisma.lmsLesson.create({
      data: {
        moduleId: data.moduleId,
        institutionId: data.institutionId,
        title: data.title,
        type: data.type,
        content: data.content,
        duration: data.duration,
        sortOrder: data.sortOrder,
        isPublished: data.isPublished,
      },
    });
  }

  updateLesson(id: string, institutionId: string, data: Prisma.LmsLessonUpdateInput) {
    return this.prisma.lmsLesson.updateMany({
      where: { id, institutionId, deletedAt: null },
      data,
    });
  }

  softDeleteLesson(id: string, institutionId: string, at: Date): Promise<Prisma.BatchPayload> {
    return this.prisma.$transaction(async (tx) => {
      await tx.lmsLessonResource.updateMany({
        where: { lessonId: id, institutionId, deletedAt: null },
        data: { deletedAt: at },
      });
      return tx.lmsLesson.updateMany({
        where: { id, institutionId, deletedAt: null },
        data: { deletedAt: at },
      });
    });
  }

  maxLessonSortOrder(
    moduleId: string,
    institutionId: string,
  ): Promise<{ _max: { sortOrder: number | null } }> {
    return this.prisma.lmsLesson.aggregate({
      where: { moduleId, institutionId, deletedAt: null },
      _max: { sortOrder: true },
    });
  }

  findLessonDetailById(
    institutionId: string,
    lessonId: string,
  ): Promise<Prisma.LmsLessonGetPayload<{
    include: {
      resources: typeof activeLessonResources;
      module: { select: { id: true; title: true; courseInstanceId: true } };
    };
  }> | null> {
    return this.prisma.lmsLesson.findFirst({
      where: { id: lessonId, institutionId, deletedAt: null },
      include: {
        resources: activeLessonResources,
        module: { select: { id: true, title: true, courseInstanceId: true } },
      },
    });
  }

  listLessonResources(institutionId: string, lessonId: string) {
    return this.prisma.lmsLessonResource.findMany({
      where: {
        lessonId,
        institutionId,
        deletedAt: null,
        lesson: { deletedAt: null },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  findLessonResource(institutionId: string, resourceId: string) {
    return this.prisma.lmsLessonResource.findFirst({
      where: {
        id: resourceId,
        institutionId,
        deletedAt: null,
        lesson: { deletedAt: null },
      },
      include: { lesson: { select: { id: true, institutionId: true } } },
    });
  }

  createLessonResource(data: {
    lessonId: string;
    institutionId: string;
    title: string;
    fileKey: string;
    fileType: string;
    fileSize: number;
  }) {
    return this.prisma.lmsLessonResource.create({ data });
  }

  updateLessonResource(
    id: string,
    institutionId: string,
    data: Prisma.LmsLessonResourceUpdateInput,
  ): Promise<Prisma.BatchPayload> {
    return this.prisma.lmsLessonResource.updateMany({
      where: { id, institutionId, deletedAt: null },
      data,
    });
  }

  softDeleteLessonResource(
    id: string,
    institutionId: string,
    at: Date,
  ): Promise<Prisma.BatchPayload> {
    return this.prisma.lmsLessonResource.updateMany({
      where: { id, institutionId, deletedAt: null },
      data: { deletedAt: at },
    });
  }

  async reorderModules(
    institutionId: string,
    courseInstanceId: string,
    orderedModuleIds: string[],
  ) {
    const existing = await this.prisma.lmsModule.findMany({
      where: { courseInstanceId, institutionId, deletedAt: null },
      select: { id: true },
    });
    const idSet = new Set(existing.map((r) => r.id));
    if (orderedModuleIds.length !== idSet.size) {
      return { ok: false as const, reason: 'count_mismatch' as const };
    }
    if (new Set(orderedModuleIds).size !== orderedModuleIds.length) {
      return { ok: false as const, reason: 'duplicate_ids' as const };
    }
    for (const id of orderedModuleIds) {
      if (!idSet.has(id)) {
        return { ok: false as const, reason: 'unknown_id' as const };
      }
    }
    await this.prisma.$transaction(
      orderedModuleIds.map((id, idx) =>
        this.prisma.lmsModule.updateMany({
          where: { id, institutionId, courseInstanceId, deletedAt: null },
          data: { sortOrder: idx },
        }),
      ),
    );
    return { ok: true as const };
  }

  async reorderLessons(institutionId: string, moduleId: string, orderedLessonIds: string[]) {
    const existing = await this.prisma.lmsLesson.findMany({
      where: { moduleId, institutionId, deletedAt: null },
      select: { id: true },
    });
    const idSet = new Set(existing.map((r) => r.id));
    if (orderedLessonIds.length !== idSet.size) {
      return { ok: false as const, reason: 'count_mismatch' as const };
    }
    if (new Set(orderedLessonIds).size !== orderedLessonIds.length) {
      return { ok: false as const, reason: 'duplicate_ids' as const };
    }
    for (const id of orderedLessonIds) {
      if (!idSet.has(id)) {
        return { ok: false as const, reason: 'unknown_id' as const };
      }
    }
    await this.prisma.$transaction(
      orderedLessonIds.map((id, idx) =>
        this.prisma.lmsLesson.updateMany({
          where: { id, institutionId, moduleId, deletedAt: null },
          data: { sortOrder: idx },
        }),
      ),
    );
    return { ok: true as const };
  }

  cloneCourseInstance(institutionId: string, sourceInstanceId: string, targetSectionId: string) {
    return this.prisma.$transaction(async (tx) => {
      const destTaken = await tx.lmsCourseInstance.findFirst({
        where: { sectionId: targetSectionId, institutionId, deletedAt: null },
        select: { id: true },
      });
      if (destTaken) {
        return { ok: false as const, code: 'target_has_instance' as const };
      }

      const source = await tx.lmsCourseInstance.findFirst({
        where: { id: sourceInstanceId, institutionId, deletedAt: null },
        include: {
          modules: {
            where: { deletedAt: null },
            orderBy: { sortOrder: 'asc' },
            include: {
              lessons: {
                where: { deletedAt: null },
                orderBy: { sortOrder: 'asc' },
                include: { resources: { ...activeLessonResources } },
              },
            },
          },
        },
      });
      if (!source) {
        return { ok: false as const, code: 'source_not_found' as const };
      }
      if (source.sectionId === targetSectionId) {
        return { ok: false as const, code: 'same_section' as const };
      }

      const created = await tx.lmsCourseInstance.create({
        data: {
          sectionId: targetSectionId,
          institutionId,
          isPublished: false,
          welcomeMessage: source.welcomeMessage,
          coverImage: source.coverImage,
          settings: source.settings as Prisma.InputJsonValue,
        },
      });

      for (const mod of source.modules) {
        const newMod = await tx.lmsModule.create({
          data: {
            courseInstanceId: created.id,
            institutionId,
            title: mod.title,
            sortOrder: mod.sortOrder,
            isPublished: mod.isPublished,
            unlockCondition: mod.unlockCondition as Prisma.InputJsonValue,
          },
        });
        for (const les of mod.lessons) {
          const newLes = await tx.lmsLesson.create({
            data: {
              moduleId: newMod.id,
              institutionId,
              title: les.title,
              type: les.type,
              content: les.content as Prisma.InputJsonValue,
              duration: les.duration,
              sortOrder: les.sortOrder,
              isPublished: les.isPublished,
            },
          });
          for (const r of les.resources) {
            await tx.lmsLessonResource.create({
              data: {
                lessonId: newLes.id,
                institutionId,
                title: r.title,
                fileKey: r.fileKey,
                fileType: r.fileType,
                fileSize: r.fileSize,
              },
            });
          }
        }
      }

      return { ok: true as const, courseInstanceId: created.id };
    });
  }
}
