import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { StudentEnrollmentStatusEnum } from '@prisma/client';
import type { AuthUser } from '../../auth/auth.types';
import { PrismaService } from '../../prisma/prisma.service';
import { BYPASS_RECORD_GUARD_KEY } from '../decorators/bypass-record-guard.decorator';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { SUPER_ADMIN_ONLY_KEY } from '../decorators/super-admin-only.decorator';
import type { StudentRecordBackfillContext } from '../record-posting/student-record-backfill.context';
import {
  STUDENT_RECORD_WRITE_KEY,
  type StudentRecordDateSource,
  type StudentRecordWriteDescriptor,
} from '../record-posting/student-record-write.meta';

type HttpRequest = {
  user?: AuthUser;
  body?: unknown;
  params?: Record<string, string>;
  backfillContext?: StudentRecordBackfillContext;
};

type ResolvedTarget = { studentId: string; recordDate: Date };

@Injectable()
export class StudentRecordPostingGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const req = context.switchToHttp().getRequest<HttpRequest>();
    const user = req.user;
    if (!user) {
      return true;
    }

    const bypass = this.reflector.getAllAndOverride<boolean>(BYPASS_RECORD_GUARD_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const superAdminOnly = this.reflector.getAllAndOverride<boolean>(SUPER_ADMIN_ONLY_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (bypass === true && superAdminOnly === true && user.role === 'SUPER_ADMIN') {
      return true;
    }

    const descriptor = this.reflector.getAllAndOverride<StudentRecordWriteDescriptor | undefined>(
      STUDENT_RECORD_WRITE_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!descriptor) {
      return true;
    }

    delete req.backfillContext;

    const targets = await this.resolveTargets(descriptor, req, user.institutionId);
    if (targets.length === 0) {
      return true;
    }

    const isBulk = descriptor.mode === 'bulkBodyAttendance';
    for (const t of targets) {
      await this.assertCanPostForStudent(user.institutionId, t.studentId, t.recordDate, req, isBulk);
    }

    return true;
  }

  private async resolveTargets(
    descriptor: StudentRecordWriteDescriptor,
    req: HttpRequest,
    institutionId: string,
  ): Promise<ResolvedTarget[]> {
    const body = this.readBody(req);
    const params = req.params ?? {};

    switch (descriptor.mode) {
      case 'bodyStudentId': {
        const studentId = this.readString(body[descriptor.studentIdField]);
        if (!studentId) {
          throw new NotFoundException('Student id missing from body');
        }
        const recordDate = await this.resolveRecordDate(descriptor.recordDate, body, params, institutionId);
        return [{ studentId, recordDate }];
      }
      case 'paramStudentId': {
        const studentId = this.readString(params[descriptor.param]);
        if (!studentId) {
          throw new NotFoundException('Student id missing from route');
        }
        const recordDate = await this.resolveRecordDate(descriptor.recordDate, body, params, institutionId);
        return [{ studentId, recordDate }];
      }
      case 'enrollmentIdParam': {
        const enrollmentId = this.readString(params[descriptor.param]);
        if (!enrollmentId) {
          throw new NotFoundException('Enrollment id missing from route');
        }
        const row = await this.prisma.studentEnrollment.findFirst({
          where: { id: enrollmentId, institutionId, deletedAt: null },
          select: { studentId: true },
        });
        if (!row) {
          throw new NotFoundException('Enrollment not found');
        }
        const recordDate = await this.resolveRecordDate(descriptor.recordDate, body, params, institutionId);
        return [{ studentId: row.studentId, recordDate }];
      }
      case 'gradeOverrideIdParam': {
        const overrideId = this.readString(params[descriptor.param]);
        if (!overrideId) {
          throw new NotFoundException('Grade override id missing from route');
        }
        const row = await this.prisma.gradeOverride.findFirst({
          where: { id: overrideId, institutionId, deletedAt: null },
          select: { enrollment: { select: { studentId: true } } },
        });
        if (!row) {
          throw new NotFoundException('Grade override not found');
        }
        const recordDate = await this.resolveRecordDate(descriptor.recordDate, body, params, institutionId);
        return [{ studentId: row.enrollment.studentId, recordDate }];
      }
      case 'attendanceIdParam': {
        const attendanceId = this.readString(params[descriptor.param]);
        if (!attendanceId) {
          throw new NotFoundException('Attendance id missing from route');
        }
        const row = await this.prisma.attendance.findFirst({
          where: { id: attendanceId, institutionId, deletedAt: null },
          select: { studentId: true, sessionDate: true },
        });
        if (!row) {
          throw new NotFoundException('Attendance not found');
        }
        return [{ studentId: row.studentId, recordDate: row.sessionDate }];
      }
      case 'lmsSubmissionIdParam': {
        const submissionId = this.readString(params[descriptor.param]);
        if (!submissionId) {
          throw new NotFoundException('Submission id missing from route');
        }
        const row = await this.prisma.lmsSubmission.findFirst({
          where: { id: submissionId, institutionId },
          select: { studentId: true },
        });
        if (!row) {
          throw new NotFoundException('LMS submission not found');
        }
        const recordDate = await this.resolveRecordDate(descriptor.recordDate, body, params, institutionId);
        return [{ studentId: row.studentId, recordDate }];
      }
      case 'bulkBodyAttendance': {
        const sessionRaw = body[descriptor.sessionDateField];
        if (typeof sessionRaw !== 'string' || !sessionRaw.trim()) {
          throw new NotFoundException('Session date missing from body');
        }
        const recordDate = this.parseIsoDate(sessionRaw);
        const entriesRaw = body[descriptor.entriesField];
        if (!Array.isArray(entriesRaw) || entriesRaw.length === 0) {
          throw new NotFoundException('Attendance entries missing from body');
        }
        const out: ResolvedTarget[] = [];
        for (const entry of entriesRaw) {
          if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
            continue;
          }
          const rec = entry as Record<string, unknown>;
          const studentId = this.readString(rec[descriptor.studentIdField]);
          if (!studentId) {
            throw new NotFoundException('Student id missing on an attendance entry');
          }
          out.push({ studentId, recordDate });
        }
        if (out.length === 0) {
          throw new NotFoundException('No valid attendance entries');
        }
        return out;
      }
    }
  }

  private async assertCanPostForStudent(
    institutionId: string,
    studentId: string,
    recordDate: Date,
    req: HttpRequest,
    isBulk: boolean,
  ): Promise<void> {
    const student = await this.prisma.student.findFirst({
      where: { id: studentId, institutionId, deletedAt: null },
      select: { enrollmentStatus: true, entityId: true },
    });
    if (!student) {
      throw new NotFoundException('Student not found');
    }

    if (this.isActiveEnrollment(student.enrollmentStatus)) {
      return;
    }

    const window = await this.prisma.backfillWindow.findFirst({
      where: {
        studentId,
        institutionId,
        entityId: student.entityId,
        isActive: true,
        fromDate: { lte: recordDate },
        toDate: { gte: recordDate },
      },
      select: { id: true, backfillRequestId: true },
    });

    if (window) {
      if (!isBulk) {
        req.backfillContext = {
          isBackfilled: true,
          backfillRequestId: window.backfillRequestId,
          backfillWindowId: window.id,
        };
      }
      return;
    }

    throw new ForbiddenException({
      statusCode: 403,
      errorCode: 'STUDENT_INACTIVE',
      message:
        'Cannot post academic or attendance records for this student while they are not ACTIVE. Reactivate the student, or use an approved backfill window for the target period.',
      studentStatus: student.enrollmentStatus,
    });
  }

  private isActiveEnrollment(status: StudentEnrollmentStatusEnum): boolean {
    return status === 'ACTIVE';
  }

  private async resolveRecordDate(
    source: StudentRecordDateSource | undefined,
    body: Record<string, unknown>,
    params: Record<string, string>,
    institutionId: string,
  ): Promise<Date> {
    if (!source || source.kind === 'now') {
      return new Date();
    }
    if (source.kind === 'bodyField') {
      const raw = body[source.field];
      if (typeof raw !== 'string' || !raw.trim()) {
        return new Date();
      }
      return this.parseIsoDate(raw);
    }
    void params;
    void institutionId;
    return new Date();
  }

  private parseIsoDate(raw: string): Date {
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) {
      return new Date();
    }
    return d;
  }

  private readBody(req: HttpRequest): Record<string, unknown> {
    const b = req.body;
    if (b && typeof b === 'object' && !Array.isArray(b)) {
      return b as Record<string, unknown>;
    }
    return {};
  }

  private readString(v: unknown): string | undefined {
    if (typeof v !== 'string') {
      return undefined;
    }
    const t = v.trim();
    return t.length > 0 ? t : undefined;
  }
}
