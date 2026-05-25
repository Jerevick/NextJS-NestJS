import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { LMS_LESSON_EMBED_EVENT, LMS_MODULE_EMBED_EVENT } from '../ai/ai-embed.listener';
import { Prisma } from '@prisma/client';
import type { AuthUser } from '../auth/auth.types';
import { AuditService } from '../audit/audit.service';
import type { CloneLmsCourseInstanceDto } from './dto/clone-lms-course-instance.dto';
import type { CreateLmsContentModuleDto } from './dto/create-lms-content-module.dto';
import type { CreateLmsCourseInstanceDto } from './dto/create-lms-course-instance.dto';
import type { CreateLmsLessonDto } from './dto/create-lms-lesson.dto';
import type { CreateLmsLessonResourceDto } from './dto/create-lms-lesson-resource.dto';
import type { ListLmsCourseInstancesQueryDto } from './dto/list-lms-course-instances-query.dto';
import type { ReorderLmsLessonsDto } from './dto/reorder-lms-lessons.dto';
import type { ReorderLmsModulesDto } from './dto/reorder-lms-modules.dto';
import type { UpdateLmsContentModuleDto } from './dto/update-lms-content-module.dto';
import type { UpdateLmsCourseInstanceDto } from './dto/update-lms-course-instance.dto';
import type { UpdateLmsLessonDto } from './dto/update-lms-lesson.dto';
import type { UpdateLmsLessonResourceDto } from './dto/update-lms-lesson-resource.dto';
import { LmsTranscodeJobsService } from './jobs/lms-transcode-jobs.service';
import { LmsRepository } from './lms.repository';
import { LmsStudentEligibilityService } from './lms-student-eligibility.service';

@Injectable()
export class LmsService {
  constructor(
    private readonly repo: LmsRepository,
    private readonly audit: AuditService,
    private readonly studentEligibility: LmsStudentEligibilityService,
    private readonly events: EventEmitter2,
    private readonly transcodeJobs: LmsTranscodeJobsService,
  ) {}

  private isVideoFileType(fileType: string): boolean {
    return fileType.trim().toLowerCase().startsWith('video/');
  }

  private lessonContentText(content: unknown): string {
    if (typeof content === 'string') return content;
    if (content && typeof content === 'object') {
      return JSON.stringify(content);
    }
    return '';
  }

  private scopeEntityId(actor: AuthUser): string | undefined {
    return actor.entityScope === 'ALL' ? undefined : actor.entityId;
  }

  async listCourseInstances(actor: AuthUser, query: ListLmsCourseInstancesQueryDto) {
    const limit = query.limit ?? 20;
    const enrolledStudentId =
      actor.role === 'STUDENT' && actor.studentId ? actor.studentId : undefined;

    const rows = await this.repo.listCourseInstances(actor.institutionId, {
      sectionId: query.sectionId,
      take: limit,
      cursor: query.cursor,
      scopeEntityId: this.scopeEntityId(actor),
      enrolledStudentId,
    });
    let nextCursor: string | undefined;
    if (rows.length > limit) {
      const last = rows.pop();
      nextCursor = last?.id;
    }
    const total = await this.repo.countCourseInstances(
      actor.institutionId,
      query.sectionId,
      this.scopeEntityId(actor),
      enrolledStudentId,
    );

    let data = rows.map((r) => this.serializeCourseInstanceList(r));

    if (query.includeStudentSnapshot === true && actor.studentId && rows.length > 0) {
      const ids = rows.map((r) => r.id);
      const STUDENT_SNAPSHOT_DUE_HORIZON_DAYS = 7;
      const [progRows, dueMap, syllabusOrder] = await Promise.all([
        this.repo.listStudentProgressByCourses(actor.institutionId, actor.studentId, ids),
        this.repo.countDueSoonOpenAssessmentsByCourse(
          actor.institutionId,
          actor.studentId,
          ids,
          STUDENT_SNAPSHOT_DUE_HORIZON_DAYS,
        ),
        this.repo.listPublishedLessonIdsInSyllabusOrder(actor.institutionId, ids),
      ]);
      const progByCourse = new Map(progRows.map((p) => [p.courseInstanceId, p]));
      data = data.map((item) => {
        const prog = progByCourse.get(item.id);
        const dueSoonCount = dueMap.get(item.id) ?? 0;
        const syllabus = syllabusOrder.get(item.id) ?? [];
        const completed = new Set(prog?.completedLessons ?? []);
        let continueLessonId: string | null = null;
        for (const lid of syllabus) {
          if (!completed.has(lid)) {
            continueLessonId = lid;
            break;
          }
        }
        const firstLessonId = syllabus[0] ?? null;
        return {
          ...item,
          studentSnapshot: {
            progressPercent: prog ? Number(prog.progressPercent) : 0,
            lastAccessedAt: prog?.lastAccessedAt?.toISOString() ?? null,
            dueSoonCount,
            dueSoonHorizonDays: STUDENT_SNAPSHOT_DUE_HORIZON_DAYS,
            continueLessonId,
            firstLessonId,
          },
        };
      });
    }

    return {
      data,
      nextCursor,
      total,
    };
  }

  async pingStudentCourseAccess(actor: AuthUser, courseInstanceId: string) {
    if (!actor.studentId) {
      return { ok: true as const, touched: false as const };
    }
    await this.studentEligibility.assertStudentEnrolledForCourseInstance(
      actor,
      courseInstanceId,
      this.scopeEntityId(actor),
    );
    await this.repo.touchStudentProgressLastAccessed(
      actor.institutionId,
      actor.studentId,
      courseInstanceId,
    );
    return { ok: true as const, touched: true as const };
  }

  async getCourseInstance(actor: AuthUser, id: string) {
    const row = await this.repo.findCourseInstanceById(
      actor.institutionId,
      id,
      this.scopeEntityId(actor),
    );
    if (!row) {
      throw new NotFoundException('Course instance not found');
    }
    await this.studentEligibility.assertStudentEnrolledForCourseSection(actor, row.sectionId);
    return this.serializeCourseInstanceDetail(row);
  }

  async createCourseInstance(actor: AuthUser, dto: CreateLmsCourseInstanceDto) {
    const section = await this.repo.findSectionInInstitution(
      actor.institutionId,
      dto.sectionId,
      this.scopeEntityId(actor),
    );
    if (!section) {
      throw new NotFoundException('Section not found');
    }
    const existing = await this.repo.findCourseInstanceBySection(
      actor.institutionId,
      dto.sectionId,
      this.scopeEntityId(actor),
    );
    if (existing) {
      throw new ConflictException('This section already has an LMS course instance');
    }
    try {
      const row = await this.repo.createCourseInstance({
        sectionId: dto.sectionId,
        institutionId: actor.institutionId,
      });
      this.audit.append({
        institutionId: actor.institutionId,
        actorId: actor.userId,
        action: 'lms.course_instance.create',
        entity: 'LmsCourseInstance',
        entityId: row.id,
        newValues: { sectionId: dto.sectionId } as Prisma.InputJsonValue,
      });
      return this.serializeCourseInstanceList(row);
    } catch (e: unknown) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException('Course instance already exists for this section');
      }
      throw e;
    }
  }

  async updateCourseInstance(actor: AuthUser, id: string, dto: UpdateLmsCourseInstanceDto) {
    const prior = await this.repo.findCourseInstanceById(
      actor.institutionId,
      id,
      this.scopeEntityId(actor),
    );
    if (!prior) {
      throw new NotFoundException('Course instance not found');
    }
    const data: Prisma.LmsCourseInstanceUpdateInput = {};
    if (dto.isPublished !== undefined) {
      data.isPublished = dto.isPublished;
    }
    if (dto.coverImage !== undefined) {
      data.coverImage = dto.coverImage;
    }
    if (dto.welcomeMessage !== undefined) {
      data.welcomeMessage = dto.welcomeMessage;
    }
    if (dto.settings !== undefined) {
      data.settings = dto.settings as Prisma.InputJsonValue;
    }
    if (Object.keys(data).length === 0) {
      throw new BadRequestException('No fields to update');
    }
    const result = await this.repo.updateCourseInstance(id, actor.institutionId, data);
    if (result.count === 0) {
      throw new NotFoundException('Course instance not found');
    }
    this.audit.append({
      institutionId: actor.institutionId,
      actorId: actor.userId,
      action: 'lms.course_instance.update',
      entity: 'LmsCourseInstance',
      entityId: id,
      oldValues: {
        isPublished: prior.isPublished,
      } as Prisma.InputJsonValue,
      newValues: data as unknown as Prisma.InputJsonValue,
    });
    const next = await this.repo.findCourseInstanceById(
      actor.institutionId,
      id,
      this.scopeEntityId(actor),
    );
    return this.serializeCourseInstanceDetail(next!);
  }

  async cloneCourseInstance(actor: AuthUser, id: string, dto: CloneLmsCourseInstanceDto) {
    const sourceRow = await this.repo.findCourseInstanceById(
      actor.institutionId,
      id,
      this.scopeEntityId(actor),
    );
    if (!sourceRow) {
      throw new NotFoundException('Course instance not found');
    }
    await this.studentEligibility.assertStudentEnrolledForCourseSection(actor, sourceRow.sectionId);
    const section = await this.repo.findSectionInInstitution(
      actor.institutionId,
      dto.targetSectionId,
      this.scopeEntityId(actor),
    );
    if (!section) {
      throw new NotFoundException('Target section not found');
    }
    const result = await this.repo.cloneCourseInstance(
      actor.institutionId,
      id,
      dto.targetSectionId.trim(),
    );
    if (!result.ok) {
      if (result.code === 'source_not_found') {
        throw new NotFoundException('Course instance not found');
      }
      if (result.code === 'target_has_instance') {
        throw new ConflictException('Target section already has an LMS course instance');
      }
      if (result.code === 'same_section') {
        throw new BadRequestException('Cannot clone a course onto its own section');
      }
      throw new BadRequestException('Clone failed');
    }
    this.audit.append({
      institutionId: actor.institutionId,
      actorId: actor.userId,
      action: 'lms.course_instance.clone',
      entity: 'LmsCourseInstance',
      entityId: result.courseInstanceId,
      newValues: { sourceId: id, targetSectionId: dto.targetSectionId } as Prisma.InputJsonValue,
    });
    return this.getCourseInstance(actor, result.courseInstanceId);
  }

  async removeCourseInstance(actor: AuthUser, id: string) {
    const prior = await this.repo.findCourseInstanceById(
      actor.institutionId,
      id,
      this.scopeEntityId(actor),
    );
    if (!prior) {
      throw new NotFoundException('Course instance not found');
    }
    await this.studentEligibility.assertStudentEnrolledForCourseSection(actor, prior.sectionId);
    const result = await this.repo.softDeleteCourseInstance(id, actor.institutionId, new Date());
    if (result.count === 0) {
      throw new NotFoundException('Course instance not found');
    }
    this.audit.append({
      institutionId: actor.institutionId,
      actorId: actor.userId,
      action: 'lms.course_instance.delete',
      entity: 'LmsCourseInstance',
      entityId: id,
      oldValues: { sectionId: prior.sectionId } as Prisma.InputJsonValue,
      newValues: { softDeleted: true } as Prisma.InputJsonValue,
    });
    return { ok: true as const, id };
  }

  async reorderModules(actor: AuthUser, courseInstanceId: string, dto: ReorderLmsModulesDto) {
    await this.assertCourseInstance(actor, courseInstanceId);
    const out = await this.repo.reorderModules(
      actor.institutionId,
      courseInstanceId,
      dto.moduleIds,
    );
    if (!out.ok) {
      throw new BadRequestException(
        out.reason === 'duplicate_ids'
          ? 'moduleIds must be unique'
          : 'moduleIds must list every module in this course exactly once',
      );
    }
    this.audit.append({
      institutionId: actor.institutionId,
      actorId: actor.userId,
      action: 'lms.module.reorder',
      entity: 'LmsCourseInstance',
      entityId: courseInstanceId,
      newValues: { order: dto.moduleIds } as Prisma.InputJsonValue,
    });
    return this.listModules(actor, courseInstanceId);
  }

  async reorderLessons(actor: AuthUser, moduleId: string, dto: ReorderLmsLessonsDto) {
    await this.assertModule(actor, moduleId);
    const out = await this.repo.reorderLessons(actor.institutionId, moduleId, dto.lessonIds);
    if (!out.ok) {
      throw new BadRequestException(
        out.reason === 'duplicate_ids'
          ? 'lessonIds must be unique'
          : 'lessonIds must list every lesson in this module exactly once',
      );
    }
    this.audit.append({
      institutionId: actor.institutionId,
      actorId: actor.userId,
      action: 'lms.lesson.reorder',
      entity: 'LmsModule',
      entityId: moduleId,
      newValues: { order: dto.lessonIds } as Prisma.InputJsonValue,
    });
    return this.listLessons(actor, moduleId);
  }

  async listModules(actor: AuthUser, courseInstanceId: string) {
    await this.assertCourseInstance(actor, courseInstanceId);
    const rows = await this.repo.listModulesForCourseInstance(
      actor.institutionId,
      courseInstanceId,
    );
    return { data: rows.map((m) => this.serializeModule(m)) };
  }

  async createModule(actor: AuthUser, courseInstanceId: string, dto: CreateLmsContentModuleDto) {
    await this.assertCourseInstance(actor, courseInstanceId);
    const max = await this.repo.maxModuleSortOrder(courseInstanceId, actor.institutionId);
    const sortOrder = dto.sortOrder ?? (max._max.sortOrder ?? -1) + 1;
    const row = await this.repo.createContentModule({
      courseInstanceId,
      institutionId: actor.institutionId,
      title: dto.title.trim(),
      sortOrder,
      isPublished: dto.isPublished ?? false,
      unlockCondition: (dto.unlockCondition ?? {}) as Prisma.InputJsonValue,
    });
    this.audit.append({
      institutionId: actor.institutionId,
      actorId: actor.userId,
      action: 'lms.module.create',
      entity: 'LmsModule',
      entityId: row.id,
      newValues: { title: row.title, courseInstanceId } as Prisma.InputJsonValue,
    });
    return {
      id: row.id,
      title: row.title,
      sortOrder: row.sortOrder,
      isPublished: row.isPublished,
      unlockCondition: row.unlockCondition,
      lessons: [],
    };
  }

  async updateModule(actor: AuthUser, moduleId: string, dto: UpdateLmsContentModuleDto) {
    const mod = await this.assertModule(actor, moduleId);
    const data: Prisma.LmsModuleUpdateInput = {};
    if (dto.title !== undefined) {
      data.title = dto.title.trim();
    }
    if (dto.sortOrder !== undefined) {
      data.sortOrder = dto.sortOrder;
    }
    if (dto.isPublished !== undefined) {
      data.isPublished = dto.isPublished;
    }
    if (dto.unlockCondition !== undefined) {
      data.unlockCondition = dto.unlockCondition as Prisma.InputJsonValue;
    }
    if (Object.keys(data).length === 0) {
      throw new BadRequestException('No fields to update');
    }
    const result = await this.repo.updateContentModule(moduleId, actor.institutionId, data);
    if (result.count === 0) {
      throw new NotFoundException('Module not found');
    }
    const rows = await this.repo.listModulesForCourseInstance(
      actor.institutionId,
      mod.courseInstance.id,
    );
    const row = rows.find((r) => r.id === moduleId);
    if (row?.isPublished) {
      this.events.emit(LMS_MODULE_EMBED_EVENT, {
        institutionId: actor.institutionId,
        entityId: actor.entityId ?? undefined,
        courseInstanceId: mod.courseInstance.id,
        moduleId,
        title: row.title,
      });
    }
    return this.serializeModule(row!);
  }

  async removeModule(actor: AuthUser, moduleId: string) {
    const mod = await this.assertModule(actor, moduleId);
    const result = await this.repo.softDeleteContentModule(
      moduleId,
      actor.institutionId,
      new Date(),
    );
    if (result.count === 0) {
      throw new NotFoundException('Module not found');
    }
    this.audit.append({
      institutionId: actor.institutionId,
      actorId: actor.userId,
      action: 'lms.module.delete',
      entity: 'LmsModule',
      entityId: moduleId,
      newValues: { softDeleted: true } as Prisma.InputJsonValue,
    });
    return { ok: true as const, id: moduleId };
  }

  async listLessons(actor: AuthUser, moduleId: string) {
    await this.assertModule(actor, moduleId);
    const rows = await this.repo.listLessonsForModule(actor.institutionId, moduleId);
    return { data: rows.map((l) => this.serializeLesson(l)) };
  }

  async createLesson(actor: AuthUser, moduleId: string, dto: CreateLmsLessonDto) {
    await this.assertModule(actor, moduleId);
    const max = await this.repo.maxLessonSortOrder(moduleId, actor.institutionId);
    const sortOrder = dto.sortOrder ?? (max._max.sortOrder ?? -1) + 1;
    const row = await this.repo.createLesson({
      moduleId,
      institutionId: actor.institutionId,
      title: dto.title.trim(),
      type: dto.type,
      content: (dto.content ?? {}) as Prisma.InputJsonValue,
      duration: dto.duration ?? null,
      sortOrder,
      isPublished: dto.isPublished ?? false,
    });
    this.audit.append({
      institutionId: actor.institutionId,
      actorId: actor.userId,
      action: 'lms.lesson.create',
      entity: 'LmsLesson',
      entityId: row.id,
      newValues: { title: row.title, moduleId } as Prisma.InputJsonValue,
    });
    return this.serializeLesson(row);
  }

  async updateLesson(actor: AuthUser, lessonId: string, dto: UpdateLmsLessonDto) {
    await this.assertLesson(actor, lessonId);
    const data: Prisma.LmsLessonUpdateInput = {};
    if (dto.title !== undefined) {
      data.title = dto.title.trim();
    }
    if (dto.type !== undefined) {
      data.type = dto.type;
    }
    if (dto.content !== undefined) {
      data.content = dto.content as Prisma.InputJsonValue;
    }
    if (dto.duration !== undefined) {
      data.duration = dto.duration;
    }
    if (dto.sortOrder !== undefined) {
      data.sortOrder = dto.sortOrder;
    }
    if (dto.isPublished !== undefined) {
      data.isPublished = dto.isPublished;
    }
    if (Object.keys(data).length === 0) {
      throw new BadRequestException('No fields to update');
    }
    const result = await this.repo.updateLesson(lessonId, actor.institutionId, data);
    if (result.count === 0) {
      throw new NotFoundException('Lesson not found');
    }
    const next = await this.repo.findLesson(actor.institutionId, lessonId);
    if (next?.isPublished && next.module) {
      this.events.emit(LMS_LESSON_EMBED_EVENT, {
        institutionId: actor.institutionId,
        entityId: actor.entityId ?? undefined,
        courseInstanceId: next.module.courseInstanceId,
        lessonId,
        title: next.title,
        contentText: this.lessonContentText(next.content),
      });
    }
    return this.serializeLesson(next!);
  }

  async getLesson(actor: AuthUser, lessonId: string) {
    await this.assertLesson(actor, lessonId);
    const row = await this.repo.findLessonDetailById(actor.institutionId, lessonId);
    if (!row) {
      throw new NotFoundException('Lesson not found');
    }
    return {
      ...this.serializeLesson(row),
      moduleId: row.module.id,
      courseInstanceId: row.module.courseInstanceId,
      moduleTitle: row.module.title,
    };
  }

  async listLessonResources(actor: AuthUser, lessonId: string) {
    await this.assertLesson(actor, lessonId);
    const rows = await this.repo.listLessonResources(actor.institutionId, lessonId);
    return { data: rows.map((r) => this.serializeLessonResource(r)) };
  }

  async createLessonResource(actor: AuthUser, lessonId: string, dto: CreateLmsLessonResourceDto) {
    await this.assertLesson(actor, lessonId);
    const row = await this.repo.createLessonResource({
      lessonId,
      institutionId: actor.institutionId,
      title: dto.title.trim(),
      fileKey: dto.fileKey.trim(),
      fileType: dto.fileType.trim(),
      fileSize: dto.fileSize ?? 0,
    });
    this.audit.append({
      institutionId: actor.institutionId,
      actorId: actor.userId,
      action: 'lms.lesson_resource.create',
      entity: 'LmsLessonResource',
      entityId: row.id,
      newValues: { lessonId } as Prisma.InputJsonValue,
    });
    if (this.isVideoFileType(dto.fileType)) {
      await this.transcodeJobs.enqueue({
        institutionId: actor.institutionId,
        lessonId,
        resourceId: row.id,
        sourceFileKey: row.fileKey,
      });
    }
    return this.serializeLessonResource(row);
  }

  async updateLessonResource(actor: AuthUser, resourceId: string, dto: UpdateLmsLessonResourceDto) {
    const prior = await this.repo.findLessonResource(actor.institutionId, resourceId);
    if (!prior) {
      throw new NotFoundException('Resource not found');
    }
    await this.assertLesson(actor, prior.lessonId);
    const data: Prisma.LmsLessonResourceUpdateInput = {};
    if (dto.title !== undefined) {
      data.title = dto.title.trim();
    }
    if (dto.fileKey !== undefined) {
      data.fileKey = dto.fileKey.trim();
    }
    if (dto.fileType !== undefined) {
      data.fileType = dto.fileType.trim();
    }
    if (dto.fileSize !== undefined) {
      data.fileSize = dto.fileSize;
    }
    if (Object.keys(data).length === 0) {
      throw new BadRequestException('No fields to update');
    }
    const result = await this.repo.updateLessonResource(resourceId, actor.institutionId, data);
    if (result.count === 0) {
      throw new NotFoundException('Resource not found');
    }
    const next = await this.repo.findLessonResource(actor.institutionId, resourceId);
    return this.serializeLessonResource({
      id: next!.id,
      lessonId: next!.lessonId,
      title: next!.title,
      fileKey: next!.fileKey,
      fileType: next!.fileType,
      fileSize: next!.fileSize,
      createdAt: next!.createdAt,
      updatedAt: next!.updatedAt,
    });
  }

  async removeLessonResource(actor: AuthUser, resourceId: string) {
    const prior = await this.repo.findLessonResource(actor.institutionId, resourceId);
    if (!prior) {
      throw new NotFoundException('Resource not found');
    }
    await this.assertLesson(actor, prior.lessonId);
    const result = await this.repo.softDeleteLessonResource(
      resourceId,
      actor.institutionId,
      new Date(),
    );
    if (result.count === 0) {
      throw new NotFoundException('Resource not found');
    }
    this.audit.append({
      institutionId: actor.institutionId,
      actorId: actor.userId,
      action: 'lms.lesson_resource.delete',
      entity: 'LmsLessonResource',
      entityId: resourceId,
      newValues: { lessonId: prior.lessonId } as Prisma.InputJsonValue,
    });
    return { ok: true as const, id: resourceId };
  }

  async removeLesson(actor: AuthUser, lessonId: string) {
    await this.assertLesson(actor, lessonId);
    const result = await this.repo.softDeleteLesson(lessonId, actor.institutionId, new Date());
    if (result.count === 0) {
      throw new NotFoundException('Lesson not found');
    }
    this.audit.append({
      institutionId: actor.institutionId,
      actorId: actor.userId,
      action: 'lms.lesson.delete',
      entity: 'LmsLesson',
      entityId: lessonId,
      newValues: { softDeleted: true } as Prisma.InputJsonValue,
    });
    return { ok: true as const, id: lessonId };
  }

  private async assertCourseInstance(actor: AuthUser, courseInstanceId: string) {
    const row = await this.repo.findCourseInstanceById(
      actor.institutionId,
      courseInstanceId,
      this.scopeEntityId(actor),
    );
    if (!row) {
      throw new NotFoundException('Course instance not found');
    }
    await this.studentEligibility.assertStudentEnrolledForCourseSection(actor, row.sectionId);
    return row;
  }

  private async assertModule(actor: AuthUser, moduleId: string) {
    const mod = await this.repo.findContentModule(actor.institutionId, moduleId);
    if (!mod) {
      throw new NotFoundException('Module not found');
    }
    await this.assertCourseInstance(actor, mod.courseInstance.id);
    return mod;
  }

  private async assertLesson(actor: AuthUser, lessonId: string) {
    const lesson = await this.repo.findLesson(actor.institutionId, lessonId);
    if (!lesson) {
      throw new NotFoundException('Lesson not found');
    }
    await this.assertCourseInstance(actor, lesson.module.courseInstanceId);
    return lesson;
  }

  private serializeLessonResource(r: {
    id: string;
    lessonId: string;
    title: string;
    fileKey: string;
    fileType: string;
    fileSize: number;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: r.id,
      lessonId: r.lessonId,
      title: r.title,
      fileKey: r.fileKey,
      fileType: r.fileType,
      fileSize: r.fileSize,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    };
  }

  private formatSectionInstructor(
    instructor: { email: string; profile: Prisma.JsonValue } | null | undefined,
  ): string | null {
    if (!instructor) {
      return null;
    }
    const raw = instructor.profile;
    const p =
      raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
    const displayName = typeof p.displayName === 'string' ? p.displayName.trim() : '';
    if (displayName.length > 0) {
      return displayName;
    }
    const first = typeof p.firstName === 'string' ? p.firstName.trim() : '';
    const last = typeof p.lastName === 'string' ? p.lastName.trim() : '';
    const combined = `${first} ${last}`.trim();
    return combined.length > 0 ? combined : instructor.email;
  }

  private serializeCourseInstanceList(row: {
    id: string;
    sectionId: string;
    institutionId: string;
    isPublished: boolean;
    coverImage: string | null;
    welcomeMessage: string | null;
    settings: Prisma.JsonValue;
    section: {
      course: { id: string; code: string; title: string };
      semester: { id: string; name: string };
      instructor: { id: string; email: string; profile: Prisma.JsonValue } | null;
    };
  }) {
    return {
      id: row.id,
      sectionId: row.sectionId,
      isPublished: row.isPublished,
      coverImage: row.coverImage,
      welcomeMessage: row.welcomeMessage,
      settings: row.settings,
      course: row.section.course,
      semester: row.section.semester,
      instructorDisplay: this.formatSectionInstructor(row.section.instructor),
    };
  }

  private serializeCourseInstanceDetail(
    row: NonNullable<Awaited<ReturnType<LmsRepository['findCourseInstanceById']>>>,
  ) {
    return {
      ...this.serializeCourseInstanceList(row),
      modules: row.modules.map((m) => this.serializeModule(m)),
    };
  }

  private serializeModule(m: {
    id: string;
    title: string;
    sortOrder: number;
    isPublished: boolean;
    unlockCondition: Prisma.JsonValue;
    lessons: Array<{
      id: string;
      title: string;
      type: string;
      content: Prisma.JsonValue;
      sortOrder: number;
      isPublished: boolean;
      duration: number | null;
      resources?: Array<{
        id: string;
        lessonId: string;
        title: string;
        fileKey: string;
        fileType: string;
        fileSize: number;
        createdAt: Date;
        updatedAt: Date;
      }>;
    }>;
  }) {
    return {
      id: m.id,
      title: m.title,
      sortOrder: m.sortOrder,
      isPublished: m.isPublished,
      unlockCondition: m.unlockCondition,
      lessons: m.lessons.map((l) => this.serializeLesson(l)),
    };
  }

  private serializeLesson(l: {
    id: string;
    title: string;
    type: string;
    content: Prisma.JsonValue;
    duration: number | null;
    sortOrder: number;
    isPublished: boolean;
    resources?: Array<{
      id: string;
      lessonId: string;
      title: string;
      fileKey: string;
      fileType: string;
      fileSize: number;
      createdAt: Date;
      updatedAt: Date;
    }>;
  }) {
    const base = {
      id: l.id,
      title: l.title,
      type: l.type,
      content: l.content,
      duration: l.duration,
      sortOrder: l.sortOrder,
      isPublished: l.isPublished,
    };
    const resources = (l.resources ?? []).map((r) => this.serializeLessonResource(r));
    return {
      ...base,
      resources,
    };
  }
}
