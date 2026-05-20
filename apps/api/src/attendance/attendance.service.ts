import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AttendanceStatus } from '@prisma/client';
import type { AuthUser } from '../auth/auth.types';
import { AuditService } from '../audit/audit.service';
import type { BulkMarkAttendanceDto } from './dto/bulk-mark-attendance.dto';
import type { IssueSessionQrDto } from './dto/issue-session-qr.dto';
import type { ListAttendanceQueryDto } from './dto/list-attendance-query.dto';
import type { MarkAttendanceDto } from './dto/mark-attendance.dto';
import type { SelfCheckInAttendanceDto } from './dto/self-check-in-attendance.dto';
import type { UpdateAttendanceDto } from './dto/update-attendance.dto';
import { verifyAttendanceSessionToken, signAttendanceSessionToken } from './attendance-qr.util';
import { sessionDateUtcStart } from './attendance-session-date.util';
import { AttendanceRepository, type AttendanceListRow } from './attendance.repository';
import QRCode from 'qrcode';

function addUtcDays(d: Date, days: number): Date {
  const x = new Date(d);
  x.setUTCDate(x.getUTCDate() + days);
  return x;
}

@Injectable()
export class AttendanceService {
  constructor(
    private readonly repo: AttendanceRepository,
    private readonly audit: AuditService,
    private readonly config: ConfigService,
  ) {}

  private hasFullWrite(user: AuthUser) {
    return user.permissions.includes('*') || user.permissions.includes('attendance.write');
  }

  private hasRead(user: AuthUser) {
    return (
      user.permissions.includes('*') ||
      user.permissions.includes('attendance.read') ||
      user.permissions.includes('attendance.write')
    );
  }

  private hasEnter(user: AuthUser) {
    return user.permissions.includes('*') || user.permissions.includes('attendance.enter');
  }

  private isSectionInstructor(user: AuthUser, instructorId: string | null) {
    return instructorId !== null && instructorId === user.userId;
  }

  assertCanViewSection(user: AuthUser, section: { instructorId: string | null }) {
    if (this.hasFullWrite(user) || this.hasRead(user)) {
      return;
    }
    if (this.hasEnter(user) && this.isSectionInstructor(user, section.instructorId)) {
      return;
    }
    throw new ForbiddenException('Not allowed to view attendance for this section');
  }

  assertCanMark(user: AuthUser, section: { instructorId: string | null }) {
    if (this.hasFullWrite(user)) {
      return;
    }
    if (this.hasEnter(user) && this.isSectionInstructor(user, section.instructorId)) {
      return;
    }
    throw new ForbiddenException('Not allowed to mark attendance for this section');
  }

  assertCanViewStudentSummary(user: AuthUser, studentId?: string) {
    if (studentId && user.studentId === studentId) {
      return;
    }
    if (user.role === 'GUARDIAN') {
      return;
    }
    if (user.permissions.includes('*')) {
      return;
    }
    if (this.hasRead(user)) {
      return;
    }
    if (user.permissions.includes('students.read')) {
      return;
    }
    throw new ForbiddenException('Not allowed to view attendance summary for this student');
  }

  private async assertEnrolled(institutionId: string, studentId: string, sectionId: string) {
    const row = await this.repo.hasActiveEnrollment(institutionId, studentId, sectionId);
    if (!row) {
      throw new BadRequestException('Student is not actively enrolled in this section');
    }
  }

  async mark(actor: AuthUser, dto: MarkAttendanceDto) {
    const section = await this.repo.findSection(actor.institutionId, dto.sectionId);
    if (!section) {
      throw new NotFoundException('Section not found');
    }
    this.assertCanMark(actor, section);
    await this.assertEnrolled(actor.institutionId, dto.studentId, dto.sectionId);

    const sessionDate = sessionDateUtcStart(dto.sessionDate);
    const existing = await this.repo.findByStudentSectionSession(
      dto.studentId,
      dto.sectionId,
      sessionDate,
    );
    if (existing) {
      if (existing.institutionId !== actor.institutionId) {
        throw new NotFoundException('Attendance record not found');
      }
      const updated = await this.repo.updateAttendance(existing.id, {
        status: dto.status,
        notes: dto.notes ?? null,
        markedById: actor.userId,
        deletedAt: null,
      });
      this.audit.append({
        institutionId: actor.institutionId,
        actorId: actor.userId,
        action: 'attendance.update',
        entity: 'Attendance',
        entityId: existing.id,
        oldValues: {
          status: existing.status,
          notes: existing.notes,
          sectionId: dto.sectionId,
          studentId: dto.studentId,
        },
        newValues: {
          status: updated.status,
          notes: updated.notes,
          sectionId: dto.sectionId,
          studentId: dto.studentId,
        },
      });
      return this.serializeRow(updated);
    }
    const created = await this.repo.createAttendance({
      institutionId: actor.institutionId,
      studentId: dto.studentId,
      sectionId: dto.sectionId,
      sessionDate,
      status: dto.status,
      markedById: actor.userId,
      notes: dto.notes,
    });
    this.audit.append({
      institutionId: actor.institutionId,
      actorId: actor.userId,
      action: 'attendance.create',
      entity: 'Attendance',
      entityId: created.id,
      newValues: {
        sectionId: dto.sectionId,
        studentId: dto.studentId,
        sessionDate: created.sessionDate,
        status: created.status,
      },
    });
    return this.serializeRow(created);
  }

  async markBulk(actor: AuthUser, dto: BulkMarkAttendanceDto) {
    const section = await this.repo.findSection(actor.institutionId, dto.sectionId);
    if (!section) {
      throw new NotFoundException('Section not found');
    }
    this.assertCanMark(actor, section);
    const sessionDate = sessionDateUtcStart(dto.sessionDate);
    const results = [];
    for (const e of dto.entries) {
      await this.assertEnrolled(actor.institutionId, e.studentId, dto.sectionId);
      const existing = await this.repo.findByStudentSectionSession(
        e.studentId,
        dto.sectionId,
        sessionDate,
      );
      if (existing) {
        if (existing.institutionId !== actor.institutionId) {
          throw new BadRequestException('Invalid attendance row for institution');
        }
        results.push(
          this.serializeRow(
            await this.repo.updateAttendance(existing.id, {
              status: e.status,
              notes: e.notes ?? null,
              markedById: actor.userId,
              deletedAt: null,
            }),
          ),
        );
      } else {
        results.push(
          this.serializeRow(
            await this.repo.createAttendance({
              institutionId: actor.institutionId,
              studentId: e.studentId,
              sectionId: dto.sectionId,
              sessionDate,
              status: e.status,
              markedById: actor.userId,
              notes: e.notes,
            }),
          ),
        );
      }
    }
    this.audit.append({
      institutionId: actor.institutionId,
      actorId: actor.userId,
      action: 'attendance.mark_bulk',
      entity: 'Attendance',
      entityId: dto.sectionId,
      newValues: {
        sectionId: dto.sectionId,
        sessionDate: sessionDate.toISOString(),
        entryCount: results.length,
      },
    });
    return { count: results.length, data: results };
  }

  private jwtSecret(): string {
    const s = this.config.get<string>('JWT_SECRET');
    if (!s?.trim()) {
      throw new BadRequestException('Server misconfiguration: JWT_SECRET');
    }
    return s.trim();
  }

  async issueSessionQr(actor: AuthUser, sectionId: string, dto: IssueSessionQrDto) {
    const section = await this.repo.findSection(actor.institutionId, sectionId);
    if (!section) {
      throw new NotFoundException('Section not found');
    }
    this.assertCanMark(actor, section);
    const sessionDate = sessionDateUtcStart(dto.sessionDate);
    const sessionDateKey = sessionDate.toISOString().slice(0, 10);

    const token = signAttendanceSessionToken(this.jwtSecret(), {
      institutionId: actor.institutionId,
      sectionId,
      sessionDate: sessionDateKey,
    });

    let dataUrl: string | undefined;
    try {
      dataUrl = await QRCode.toDataURL(token, { margin: 1, width: 280 });
    } catch {
      dataUrl = undefined;
    }

    return {
      token,
      sectionId,
      sessionDate: sessionDateKey,
      expiresInHours: 8,
      qrDataUrl: dataUrl,
    };
  }

  /**
   * Student self-service: scan/instantiate QR token and mark PRESENT for the anchored session date.
   * Role STUDENT enforced at controller layer; JWT must match enrollment + institution.
   */
  async selfCheckIn(actor: AuthUser, dto: SelfCheckInAttendanceDto) {
    if (actor.role !== 'STUDENT') {
      throw new ForbiddenException('Only student accounts may use attendance self check-in');
    }
    const studentId = actor.studentId;
    if (!studentId) {
      throw new ForbiddenException('Student account is not linked to a student record');
    }

    let claims;
    try {
      claims = verifyAttendanceSessionToken(this.jwtSecret(), dto.token);
    } catch {
      throw new BadRequestException('Invalid or expired attendance session token');
    }
    if (claims.institutionId !== actor.institutionId) {
      throw new ForbiddenException('Attendance token institution mismatch');
    }

    const section = await this.repo.findSection(actor.institutionId, claims.sectionId);
    if (!section) {
      throw new NotFoundException('Section not found');
    }

    await this.assertEnrolled(actor.institutionId, studentId, claims.sectionId);
    const sessionDate = sessionDateUtcStart(claims.sessionDate);

    const existing = await this.repo.findByStudentSectionSession(
      studentId,
      claims.sectionId,
      sessionDate,
    );
    if (existing) {
      if (existing.institutionId !== actor.institutionId) {
        throw new NotFoundException('Attendance record not found');
      }
      const updated = await this.repo.updateAttendance(existing.id, {
        status: 'PRESENT',
        notes: 'Self check-in (QR)',
        markedById: actor.userId,
        deletedAt: null,
      });
      this.audit.append({
        institutionId: actor.institutionId,
        actorId: actor.userId,
        action: 'attendance.update',
        entity: 'Attendance',
        entityId: existing.id,
        oldValues: {
          status: existing.status,
          notes: existing.notes,
          sectionId: claims.sectionId,
          studentId,
        },
        newValues: {
          status: updated.status,
          notes: updated.notes,
          sectionId: claims.sectionId,
          studentId,
        },
      });
      return this.serializeRow(updated);
    }

    const created = await this.repo.createAttendance({
      institutionId: actor.institutionId,
      studentId,
      sectionId: claims.sectionId,
      sessionDate,
      status: 'PRESENT',
      markedById: actor.userId,
      notes: 'Self check-in (QR)',
    });
    this.audit.append({
      institutionId: actor.institutionId,
      actorId: actor.userId,
      action: 'attendance.create',
      entity: 'Attendance',
      entityId: created.id,
      newValues: {
        sectionId: claims.sectionId,
        studentId,
        sessionDate: created.sessionDate,
        status: created.status,
        source: 'qr_self_check_in',
      },
    });
    return this.serializeRow(created);
  }

  async listForSection(actor: AuthUser, sectionId: string, query: ListAttendanceQueryDto) {
    const section = await this.repo.findSection(actor.institutionId, sectionId);
    if (!section) {
      throw new NotFoundException('Section not found');
    }
    this.assertCanViewSection(actor, section);

    const from = sessionDateUtcStart(query.from);
    const toStart = sessionDateUtcStart(query.to);
    if (toStart < from) {
      throw new BadRequestException('`to` must be on or after `from`');
    }
    const toExclusive = addUtcDays(toStart, 1);
    const limit = query.limit ?? 50;

    const where = this.repo.buildListWhere({
      institutionId: actor.institutionId,
      sectionId,
      from,
      toExclusive,
      studentId: query.studentId,
    });
    const rows = await this.repo.findPage(where, limit, query.cursor);
    let nextCursor: string | undefined;
    if (rows.length > limit) {
      const last = rows.pop();
      nextCursor = last?.id;
    }
    const total = await this.repo.countWhere(where);
    return {
      data: rows.map((r) => this.serializeRow(r)),
      nextCursor,
      total,
    };
  }

  async update(actor: AuthUser, id: string, dto: UpdateAttendanceDto) {
    const row = await this.repo.findById(actor.institutionId, id);
    if (!row) {
      throw new NotFoundException('Attendance not found');
    }
    const section = await this.repo.findSection(actor.institutionId, row.sectionId);
    if (!section) {
      throw new NotFoundException('Section not found');
    }
    this.assertCanMark(actor, section);

    const patch: {
      status?: AttendanceStatus;
      notes?: string | null;
      markedById: string;
    } = { markedById: actor.userId };
    if (dto.status !== undefined) {
      patch.status = dto.status;
    }
    if (dto.notes !== undefined) {
      patch.notes = dto.notes;
    }
    const updated = await this.repo.updateAttendance(row.id, patch);
    this.audit.append({
      institutionId: actor.institutionId,
      actorId: actor.userId,
      action: 'attendance.update',
      entity: 'Attendance',
      entityId: row.id,
      oldValues: {
        status: row.status,
        notes: row.notes,
        sectionId: row.sectionId,
        studentId: row.studentId,
      },
      newValues: {
        status: updated.status,
        notes: updated.notes,
        sectionId: row.sectionId,
        studentId: row.studentId,
      },
    });
    return this.serializeRow(updated);
  }

  async remove(actor: AuthUser, id: string) {
    const row = await this.repo.findById(actor.institutionId, id);
    if (!row) {
      throw new NotFoundException('Attendance not found');
    }
    const section = await this.repo.findSection(actor.institutionId, row.sectionId);
    if (!section) {
      throw new NotFoundException('Section not found');
    }
    this.assertCanMark(actor, section);
    await this.repo.updateAttendance(row.id, { deletedAt: new Date() });
    this.audit.append({
      institutionId: actor.institutionId,
      actorId: actor.userId,
      action: 'attendance.delete',
      entity: 'Attendance',
      entityId: row.id,
      oldValues: {
        status: row.status,
        sectionId: row.sectionId,
        studentId: row.studentId,
        sessionDate: row.sessionDate,
      },
      newValues: { softDeleted: true },
    });
    return { ok: true as const, id };
  }

  async studentSummary(actor: AuthUser, studentId: string) {
    this.assertCanViewStudentSummary(actor, studentId);
    const student = await this.repo.findStudent(actor.institutionId, studentId);
    if (!student) {
      throw new NotFoundException('Student not found');
    }
    const [total, byStatus, bySectionStatus] = await Promise.all([
      this.repo.countAttendanceForStudent(actor.institutionId, studentId),
      this.repo.groupAttendanceByStatusForStudent(actor.institutionId, studentId),
      this.repo.groupAttendanceBySectionAndStatusForStudent(actor.institutionId, studentId),
    ]);
    const statusCounts = Object.fromEntries(byStatus.map((r) => [r.status, r._count.id])) as Record<
      string,
      number
    >;
    const sectionMap = new Map<
      string,
      { sectionId: string; counts: Record<string, number>; total: number }
    >();
    for (const row of bySectionStatus) {
      const sid = row.sectionId;
      if (!sectionMap.has(sid)) {
        sectionMap.set(sid, { sectionId: sid, counts: {}, total: 0 });
      }
      const entry = sectionMap.get(sid)!;
      entry.counts[row.status] = row._count.id;
      entry.total += row._count.id;
    }
    return {
      studentId: student.id,
      studentNumber: student.studentNumber,
      totalSessions: total,
      byStatus: statusCounts,
      bySection: [...sectionMap.values()],
    };
  }

  private serializeRow(row: AttendanceListRow) {
    return {
      id: row.id,
      sessionDate: row.sessionDate,
      status: row.status,
      notes: row.notes,
      markedBy: row.marker,
      student: row.student,
      section: row.section,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
