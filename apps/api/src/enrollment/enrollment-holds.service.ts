import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { AuthUser } from '../auth/auth.types';
import { AuditService } from '../audit/audit.service';
import type { JoinWaitlistDto } from './dto/join-waitlist.dto';
import type { LiftEnrollmentHoldDto } from './dto/lift-enrollment-hold.dto';
import type { PlaceEnrollmentHoldDto } from './dto/place-enrollment-hold.dto';
import { EnrollmentRepository } from './enrollment.repository';

@Injectable()
export class EnrollmentHoldsService {
  constructor(
    private readonly repo: EnrollmentRepository,
    private readonly audit: AuditService,
  ) {}

  async assertNoActiveHolds(institutionId: string, studentId: string): Promise<void> {
    const count = await this.repo.countActiveHolds(institutionId, studentId);
    if (count > 0) {
      throw new BadRequestException(
        'Student has an active enrollment hold that blocks new course registration',
      );
    }
  }

  async listForStudent(actor: AuthUser, studentId: string, activeOnly = true) {
    const student = await this.repo.findStudent(actor.institutionId, studentId);
    if (!student) {
      throw new NotFoundException('Student not found');
    }
    if (actor.entityScope === 'ENTITY' && student.entityId !== actor.entityId) {
      throw new NotFoundException('Student not found');
    }
    const rows = await this.repo.listHoldsForStudent(actor.institutionId, studentId, activeOnly);
    return {
      data: rows.map((r) => ({
        id: r.id,
        type: r.type,
        reason: r.reason,
        placedAt: r.placedAt,
        liftedAt: r.liftedAt,
        liftNotes: r.liftNotes,
        placedBy: r.placedBy,
        liftedBy: r.liftedBy,
      })),
      total: rows.length,
    };
  }

  async place(actor: AuthUser, studentId: string, dto: PlaceEnrollmentHoldDto) {
    const student = await this.repo.findStudent(actor.institutionId, studentId);
    if (!student) {
      throw new NotFoundException('Student not found');
    }
    if (actor.entityScope === 'ENTITY' && student.entityId !== actor.entityId) {
      throw new NotFoundException('Student not found');
    }
    const row = await this.repo.createHold({
      studentId,
      institutionId: actor.institutionId,
      entityId: student.entityId,
      type: dto.type,
      reason: dto.reason.trim(),
      placedById: actor.userId,
    });
    this.audit.append({
      institutionId: actor.institutionId,
      actorId: actor.userId,
      action: 'enrollment_hold.place',
      entity: 'EnrollmentHold',
      entityId: row.id,
      newValues: { studentId, type: dto.type } as Prisma.InputJsonValue,
    });
    return {
      id: row.id,
      type: row.type,
      reason: row.reason,
      placedAt: row.placedAt,
      placedBy: row.placedBy,
    };
  }

  async lift(actor: AuthUser, holdId: string, dto: LiftEnrollmentHoldDto) {
    const hold = await this.repo.findHoldById(actor.institutionId, holdId);
    if (!hold) {
      throw new NotFoundException('Enrollment hold not found');
    }
    if (actor.entityScope === 'ENTITY' && hold.entityId !== actor.entityId) {
      throw new NotFoundException('Enrollment hold not found');
    }
    if (hold.liftedAt !== null) {
      throw new BadRequestException('Hold is already lifted');
    }
    const result = await this.repo.liftHold(
      holdId,
      actor.institutionId,
      actor.userId,
      dto.liftNotes?.trim() ?? null,
    );
    if (result.count === 0) {
      throw new BadRequestException('Hold could not be lifted');
    }
    this.audit.append({
      institutionId: actor.institutionId,
      actorId: actor.userId,
      action: 'enrollment_hold.lift',
      entity: 'EnrollmentHold',
      entityId: holdId,
      oldValues: { liftedAt: null },
      newValues: { liftedAt: new Date().toISOString() },
    });
    return { ok: true as const, id: holdId };
  }

  async joinWaitlist(actor: AuthUser, sectionId: string, dto: JoinWaitlistDto) {
    const student = await this.repo.findStudent(actor.institutionId, dto.studentId);
    if (!student) {
      throw new NotFoundException('Student not found');
    }
    if (student.enrollmentStatus !== 'ACTIVE') {
      throw new BadRequestException('Student is not in an enrollable status');
    }
    const section = await this.repo.findSectionWithCourseSemester(actor.institutionId, sectionId);
    if (!section) {
      throw new NotFoundException('Section not found');
    }
    if (section.entityId !== student.entityId) {
      throw new BadRequestException(
        'Section belongs to a different campus entity than this student',
      );
    }
    if (actor.entityScope === 'ENTITY' && section.entityId !== actor.entityId) {
      throw new NotFoundException('Section not found');
    }

    const existingEnrollment = await this.repo.findEnrollmentByStudentAndSection(
      dto.studentId,
      sectionId,
    );
    if (
      existingEnrollment &&
      existingEnrollment.deletedAt === null &&
      existingEnrollment.status === 'ENROLLED'
    ) {
      throw new ConflictException('Student is already enrolled in this section');
    }

    const existingWait = await this.repo.findWaitlistEntry(
      actor.institutionId,
      dto.studentId,
      sectionId,
    );
    if (existingWait && existingWait.status === 'WAITING') {
      throw new ConflictException('Student is already on the waitlist for this section');
    }

    const maxPos = await this.repo.maxWaitlistPosition(sectionId);
    const position = (maxPos._max.position ?? 0) + 1;
    const row = await this.repo.createWaitlistEntry({
      studentId: dto.studentId,
      sectionId,
      semesterId: section.semesterId,
      institutionId: actor.institutionId,
      position,
    });
    this.audit.append({
      institutionId: actor.institutionId,
      actorId: actor.userId,
      action: 'waitlist.join',
      entity: 'SectionWaitlistEntry',
      entityId: row.id,
      newValues: { studentId: dto.studentId, sectionId, position },
    });
    return {
      id: row.id,
      status: row.status,
      position: row.position,
      joinedAt: row.joinedAt,
      student: row.student,
      section: {
        id: row.section.id,
        course: row.section.course,
      },
    };
  }

  async listWaitlist(actor: AuthUser, sectionId: string) {
    const section = await this.repo.findSectionWithCourseSemester(actor.institutionId, sectionId);
    if (!section) {
      throw new NotFoundException('Section not found');
    }
    if (actor.entityScope === 'ENTITY' && section.entityId !== actor.entityId) {
      throw new NotFoundException('Section not found');
    }
    const rows = await this.repo.listSectionWaitlist(actor.institutionId, sectionId, 'WAITING');
    return {
      data: rows.map((r) => ({
        id: r.id,
        position: r.position,
        status: r.status,
        joinedAt: r.joinedAt,
        student: r.student,
      })),
      total: rows.length,
    };
  }

  async leaveWaitlist(actor: AuthUser, entryId: string) {
    const result = await this.repo.removeWaitlistEntry(entryId, actor.institutionId);
    if (result.count === 0) {
      throw new NotFoundException('Waitlist entry not found');
    }
    this.audit.append({
      institutionId: actor.institutionId,
      actorId: actor.userId,
      action: 'waitlist.leave',
      entity: 'SectionWaitlistEntry',
      entityId: entryId,
    });
    return { ok: true as const, id: entryId };
  }

  async findFirstWaiting(sectionId: string, institutionId: string) {
    return this.repo.findFirstWaiting(sectionId, institutionId);
  }

  async markPromoted(entryId: string, institutionId: string) {
    await this.repo.markWaitlistPromoted(entryId, institutionId);
  }
}
