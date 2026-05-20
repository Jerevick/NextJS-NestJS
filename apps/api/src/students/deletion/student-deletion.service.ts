import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { StudentEnrollmentStatusEnum } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import { StatusChangeService } from '../status/status-change.service';

const ANON_PROFILE = {
  firstName: 'REDACTED',
  lastName: 'REDACTED',
  displayName: 'REDACTED',
  phone: null,
  photo: null,
};

@Injectable()
export class StudentDeletionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly statusChanges: StatusChangeService,
  ) {}

  /**
   * Permanent deletion after workflow approval — anonymises student data and hard-deletes auth user.
   */
  async execute(params: {
    institutionId: string;
    studentId: string;
    actorUserId: string;
    workflowInstanceId?: string;
    typedStudentNumber?: string;
  }): Promise<{ studentId: string; studentNumber: string }> {
    const student = await this.prisma.student.findFirst({
      where: { id: params.studentId, institutionId: params.institutionId, deletedAt: null },
      include: { user: { select: { id: true, email: true } } },
    });
    if (!student) {
      throw new NotFoundException('Student not found');
    }
    if (student.enrollmentStatus === StudentEnrollmentStatusEnum.ACTIVE) {
      throw new BadRequestException(
        'ACTIVE students cannot be permanently deleted — inactivate first',
      );
    }
    if (student.enrollmentStatus === StudentEnrollmentStatusEnum.PERMANENTLY_DELETED) {
      return { studentId: student.id, studentNumber: student.studentNumber };
    }
    if (params.typedStudentNumber && params.typedStudentNumber.trim() !== student.studentNumber) {
      throw new BadRequestException('Typed student number confirmation does not match');
    }

    const activeWorkflows = await this.prisma.workflowInstance.count({
      where: {
        institutionId: params.institutionId,
        status: 'IN_PROGRESS',
        entityId_record: student.id,
        ...(params.workflowInstanceId ? { id: { not: params.workflowInstanceId } } : {}),
      },
    });
    if (activeWorkflows > 0) {
      throw new BadRequestException('Student has active workflow instances');
    }

    await this.statusChanges.changeEnrollmentStatus({
      institutionId: params.institutionId,
      actorUserId: params.actorUserId,
      studentId: student.id,
      toStatus: StudentEnrollmentStatusEnum.PERMANENTLY_DELETED,
      reason: 'Permanent deletion executed after workflow approval',
    });

    const userId = student.userId;
    await this.prisma.$transaction(async (tx) => {
      if (userId) {
        await tx.user.update({
          where: { id: userId },
          data: {
            profile: ANON_PROFILE,
            isActive: false,
            email: `deleted+${student.studentNumber}@anonymized.local`,
          },
        });
        await tx.user.delete({ where: { id: userId } });
      }

      await tx.student.update({
        where: { id: student.id },
        data: {
          userId: null,
          guardians: [],
          emergencyContacts: [],
          specialNeeds: {},
          photo: null,
          inactiveReason: null,
          inactiveSince: null,
        },
      });
    });

    this.audit.append({
      institutionId: params.institutionId,
      actorId: params.actorUserId,
      action: 'student.permanently_deleted',
      entity: 'Student',
      entityId: student.id,
      oldValues: { enrollmentStatus: student.enrollmentStatus, userId },
      newValues: {
        enrollmentStatus: StudentEnrollmentStatusEnum.PERMANENTLY_DELETED,
        studentNumber: student.studentNumber,
        workflowInstanceId: params.workflowInstanceId ?? null,
      },
    });

    return { studentId: student.id, studentNumber: student.studentNumber };
  }
}
