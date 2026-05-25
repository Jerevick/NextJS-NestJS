import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { unzipSync } from 'fflate';
import type { AuthUser } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { ObjectStorageService } from '../storage/object-storage.service';
import type { RegisterScormPackageDto } from './dto/register-scorm-package.dto';
import type { ScormCommitDto } from './dto/scorm-commit.dto';
import { LmsStudentEligibilityService } from './lms-student-eligibility.service';

type ScormLessonContent = {
  scormVersion?: string;
  packagePrefix?: string;
  launchHref?: string;
  manifestKey?: string;
  cmi?: Record<string, string>;
};

@Injectable()
export class LmsScormService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: ObjectStorageService,
    private readonly eligibility: LmsStudentEligibilityService,
  ) {}

  private parseManifest(xml: string): { launchHref: string; version: string } {
    const resourceHref = xml.match(/<resource[^>]+href="([^"]+)"/i)?.[1];
    const schema = xml.match(/<schemaversion[^>]*>([^<]+)</i)?.[1]?.trim();
    if (!resourceHref) {
      throw new BadRequestException('imsmanifest.xml missing resource href');
    }
    const version =
      schema && /2004|1\.3/i.test(schema) ? '2004' : schema && /1\.2/i.test(schema) ? '1.2' : '1.2';
    return { launchHref: resourceHref.replace(/^\//, ''), version };
  }

  async registerPackage(actor: AuthUser, lessonId: string, dto: RegisterScormPackageDto) {
    const lesson = await this.prisma.lmsLesson.findFirst({
      where: { id: lessonId, institutionId: actor.institutionId, deletedAt: null },
      select: { id: true, moduleId: true, type: true },
    });
    if (!lesson) {
      throw new NotFoundException('Lesson not found');
    }
    const zipBuf = await this.storage.getBuffer(dto.zipFileKey.trim());
    if (!zipBuf || zipBuf.length < 4) {
      throw new BadRequestException('SCORM zip not found in storage');
    }
    const entries = unzipSync(new Uint8Array(zipBuf));
    const manifestPath = Object.keys(entries).find((p) =>
      p.replace(/\\/g, '/').toLowerCase().endsWith('imsmanifest.xml'),
    );
    if (!manifestPath) {
      throw new BadRequestException('imsmanifest.xml not found in package');
    }
    const manifestXml = new TextDecoder().decode(entries[manifestPath]);
    const { launchHref, version } = this.parseManifest(manifestXml);
    const prefix = `lms/scorm/${actor.institutionId}/${lessonId}`;
    for (const [relPath, bytes] of Object.entries(entries)) {
      if (relPath.endsWith('/')) {
        continue;
      }
      const key = `${prefix}/${relPath.replace(/\\/g, '/')}`;
      const ext = relPath.split('.').pop()?.toLowerCase() ?? '';
      const contentType =
        ext === 'html' || ext === 'htm'
          ? 'text/html'
          : ext === 'js'
            ? 'application/javascript'
            : ext === 'css'
              ? 'text/css'
              : ext === 'xml'
                ? 'application/xml'
                : 'application/octet-stream';
      await this.storage.putBuffer(key, Buffer.from(bytes), contentType);
    }
    const launchKey = `${prefix}/${launchHref}`;
    const launchUrl = await this.storage.resolveDownloadUrl(launchKey);
    const content: ScormLessonContent = {
      scormVersion: version,
      packagePrefix: prefix,
      launchHref,
      manifestKey: `${prefix}/${manifestPath.replace(/\\/g, '/')}`,
      cmi: {},
    };
    await this.prisma.lmsLesson.update({
      where: { id: lessonId },
      data: {
        type: 'SCORM',
        content: { ...content, launchUrl: launchUrl ?? undefined } as object,
      },
    });
    return { lessonId, scormVersion: version, launchUrl, packagePrefix: prefix };
  }

  async getLaunch(actor: AuthUser, lessonId: string) {
    await this.eligibility.assertMayUseStudentLms(actor);
    const lesson = await this.prisma.lmsLesson.findFirst({
      where: { id: lessonId, institutionId: actor.institutionId, deletedAt: null, type: 'SCORM' },
      select: {
        id: true,
        title: true,
        content: true,
        module: { select: { courseInstanceId: true } },
      },
    });
    if (!lesson) {
      throw new NotFoundException('SCORM lesson not found');
    }
    if (actor.role === 'STUDENT' && actor.studentId) {
      await this.eligibility.assertStudentEnrolledForCourseInstance(
        actor,
        lesson.module.courseInstanceId,
      );
    }
    const content = (lesson.content ?? {}) as ScormLessonContent;
    const launchKey =
      content.packagePrefix && content.launchHref
        ? `${content.packagePrefix}/${content.launchHref}`
        : null;
    const launchUrl = launchKey ? await this.storage.resolveDownloadUrl(launchKey) : null;
    if (!launchUrl) {
      throw new BadRequestException('SCORM package not configured for this lesson');
    }
    return {
      lessonId: lesson.id,
      title: lesson.title,
      launchUrl,
      scormVersion: content.scormVersion ?? '1.2',
      courseInstanceId: lesson.module.courseInstanceId,
      cmi: content.cmi ?? {},
    };
  }

  async commitProgress(actor: AuthUser, lessonId: string, dto: ScormCommitDto) {
    await this.eligibility.assertMayUseStudentLms(actor);
    if (!actor.studentId) {
      throw new ForbiddenException('SCORM progress requires a student identity');
    }
    const lesson = await this.prisma.lmsLesson.findFirst({
      where: { id: lessonId, institutionId: actor.institutionId, deletedAt: null, type: 'SCORM' },
      select: {
        id: true,
        content: true,
        module: { select: { courseInstanceId: true } },
      },
    });
    if (!lesson) {
      throw new NotFoundException('SCORM lesson not found');
    }
    await this.eligibility.assertStudentEnrolledForCourseInstance(
      actor,
      lesson.module.courseInstanceId,
    );
    const prior = (lesson.content ?? {}) as ScormLessonContent;
    const cmi = { ...(prior.cmi ?? {}), ...(dto.cmi ?? {}) };
    if (dto.lessonStatus) {
      cmi['cmi.core.lesson_status'] = dto.lessonStatus;
    }
    if (dto.completionStatus) {
      cmi['cmi.completion_status'] = dto.completionStatus;
    }
    if (dto.scoreRaw) {
      cmi['cmi.core.score.raw'] = dto.scoreRaw;
    }
    const completed =
      dto.lessonStatus === 'completed' ||
      dto.lessonStatus === 'passed' ||
      dto.completionStatus === 'completed';
    await this.prisma.lmsLesson.update({
      where: { id: lessonId },
      data: { content: { ...prior, cmi } as object },
    });
    if (completed) {
      await this.prisma.lmsLessonCompletion.upsert({
        where: {
          lessonId_studentId: { lessonId, studentId: actor.studentId },
        },
        create: {
          lessonId,
          studentId: actor.studentId,
          institutionId: actor.institutionId,
        },
        update: { completedAt: new Date() },
      });
      const progress = await this.prisma.lmsStudentProgress.findUnique({
        where: {
          studentId_courseInstanceId: {
            studentId: actor.studentId,
            courseInstanceId: lesson.module.courseInstanceId,
          },
        },
      });
      const completedLessons = new Set(progress?.completedLessons ?? []);
      completedLessons.add(lessonId);
      const totalLessons = await this.prisma.lmsLesson.count({
        where: {
          institutionId: actor.institutionId,
          deletedAt: null,
          module: {
            courseInstanceId: lesson.module.courseInstanceId,
            deletedAt: null,
          },
        },
      });
      const progressPercent = totalLessons > 0 ? (completedLessons.size / totalLessons) * 100 : 100;
      await this.prisma.lmsStudentProgress.upsert({
        where: {
          studentId_courseInstanceId: {
            studentId: actor.studentId,
            courseInstanceId: lesson.module.courseInstanceId,
          },
        },
        create: {
          studentId: actor.studentId,
          courseInstanceId: lesson.module.courseInstanceId,
          institutionId: actor.institutionId,
          completedLessons: [...completedLessons],
          progressPercent,
          lastAccessedAt: new Date(),
        },
        update: {
          completedLessons: [...completedLessons],
          progressPercent,
          lastAccessedAt: new Date(),
        },
      });
    }
    return { ok: true, completed };
  }
}
