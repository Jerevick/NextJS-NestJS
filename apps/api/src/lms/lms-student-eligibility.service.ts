import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { EnrollmentRowStatus } from '@prisma/client';
import type { AuthUser } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';

const LMS_ENROLLMENT_STATUSES: EnrollmentRowStatus[] = [
  EnrollmentRowStatus.ENROLLED,
  EnrollmentRowStatus.COMPLETED,
];

@Injectable()
export class LmsStudentEligibilityService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Non-student LMS roles bypass. STUDENT JWTs omit `studentId` when enrollment is not ACTIVE.
   * We also re-fetch status so LMS access drops immediately after an in-flight session becomes inactive.
   */
  async assertMayUseStudentLms(actor: AuthUser): Promise<void> {
    if (actor.role !== 'STUDENT') {
      return;
    }
    if (!actor.studentId) {
      throw new ForbiddenException('LMS requires an enrollment-linked student identity.');
    }
    const row = await this.prisma.student.findFirst({
      where: { id: actor.studentId, institutionId: actor.institutionId, deletedAt: null },
      select: { enrollmentStatus: true },
    });
    if (!row) {
      throw new ForbiddenException('Student profile not found for LMS.');
    }
    if (row.enrollmentStatus !== 'ACTIVE') {
      throw new ForbiddenException(
        'LMS is available only while your student enrollment is active.',
      );
    }
  }

  /** Students cannot read or mutate another student's LMS records via API parameters. */
  assertStudentTargetsSelf(actor: AuthUser, targetStudentId: string): void {
    if (actor.role !== 'STUDENT') {
      return;
    }
    if (!actor.studentId || targetStudentId !== actor.studentId) {
      throw new ForbiddenException('You may only access LMS data for yourself.');
    }
  }

  /** Non-students bypass. Students must carry an ACTIVE row in this section. */
  async assertStudentEnrolledForCourseSection(actor: AuthUser, sectionId: string): Promise<void> {
    if (actor.role !== 'STUDENT' || !actor.studentId) {
      return;
    }
    const enr = await this.prisma.studentEnrollment.findFirst({
      where: {
        studentId: actor.studentId,
        sectionId,
        institutionId: actor.institutionId,
        deletedAt: null,
        status: { in: LMS_ENROLLMENT_STATUSES },
      },
      select: { id: true },
    });
    if (!enr) {
      throw new ForbiddenException(
        'You must be enrolled in this course section to access its LMS materials.',
      );
    }
  }

  /**
   * Validates section enrollment when the LMS resource is keyed by **`courseInstanceId`**.
   * FACULTY and other roles bypass; STUDENT JWTs missing **`studentId`** bypass here (interceptors block LMS earlier).
   */
  async assertStudentEnrolledForCourseInstance(
    actor: AuthUser,
    courseInstanceId: string,
    scopeEntityId?: string,
  ): Promise<void> {
    if (actor.role !== 'STUDENT' || !actor.studentId) {
      return;
    }

    const ci = await this.prisma.lmsCourseInstance.findFirst({
      where: {
        id: courseInstanceId,
        institutionId: actor.institutionId,
        deletedAt: null,
        ...(scopeEntityId
          ? {
              section: {
                entityId: scopeEntityId,
                deletedAt: null,
              },
            }
          : {}),
      },
      select: { sectionId: true },
    });
    if (!ci) {
      throw new NotFoundException('Course instance not found');
    }
    await this.assertStudentEnrolledForCourseSection(actor, ci.sectionId);
  }

  /**
   * STUDENT callers must belong to this assessment's section. Staff bypass.
   */
  async assertStudentEnrolledForAssessment(
    actor: AuthUser,
    assessmentId: string,
    scopeEntityId?: string,
  ): Promise<void> {
    if (actor.role !== 'STUDENT' || !actor.studentId) {
      return;
    }

    const a = await this.prisma.lmsAssessment.findFirst({
      where: {
        id: assessmentId,
        institutionId: actor.institutionId,
        deletedAt: null,
        ...(scopeEntityId
          ? {
              courseInstance: {
                section: { entityId: scopeEntityId, deletedAt: null },
              },
            }
          : {}),
      },
      select: { courseInstanceId: true, courseInstance: { select: { sectionId: true } } },
    });
    if (!a) {
      throw new NotFoundException('Assessment not found');
    }
    await this.assertStudentEnrolledForCourseSection(actor, a.courseInstance.sectionId);
  }
}
