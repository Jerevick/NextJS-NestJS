import { ForbiddenException } from '@nestjs/common';
import type { AuthUser } from '../auth/auth.types';
import { isGuardianLinkedToStudent } from '../finance/finance-guardian-access.util';

export function assertPortalStudent(actor: AuthUser): string {
  if (actor.role !== 'STUDENT') {
    throw new ForbiddenException('Student portal access only');
  }
  if (!actor.studentId) {
    throw new ForbiddenException('Student account is not linked to a student record');
  }
  return actor.studentId;
}

export function assertStudentWritable(enrollmentStatus: string): void {
  if (enrollmentStatus !== 'ACTIVE') {
    throw new ForbiddenException(
      'Your enrollment is not active — portal is read-only until status is ACTIVE',
    );
  }
}

export function assertPortalGuardian(actor: AuthUser): void {
  if (actor.role !== 'GUARDIAN') {
    throw new ForbiddenException('Guardian portal access only');
  }
}

export function assertGuardianLinked(guardians: unknown, actor: AuthUser, studentId: string): void {
  assertPortalGuardian(actor);
  if (!isGuardianLinkedToStudent(guardians, actor.userId, actor.email)) {
    throw new ForbiddenException('You are not linked as a guardian for this student');
  }
}
