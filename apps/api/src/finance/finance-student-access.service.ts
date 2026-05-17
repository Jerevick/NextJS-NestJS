import { ForbiddenException, Injectable } from '@nestjs/common';
import type { AuthUser } from '../auth/auth.types';
import { FinanceRepository } from './finance.repository';
import { isGuardianLinkedToStudent } from './finance-guardian-access.util';

@Injectable()
export class FinanceStudentAccessService {
  constructor(private readonly repo: FinanceRepository) {}

  /**
   * Students: own record only. Guardians: linked via Student.guardians JSON only.
   * Staff: finance.read with entity scope (enforced by repository findStudent).
   */
  async assertFinanceStudentAccess(actor: AuthUser, studentId: string) {
    if (actor.studentId) {
      if (actor.studentId !== studentId) {
        throw new ForbiddenException('You may only access your own student finance account');
      }
      return;
    }

    if (actor.role === 'GUARDIAN') {
      const student = await this.repo.findStudentWithGuardians(actor.institutionId, studentId);
      if (!student) {
        throw new ForbiddenException('Student not found');
      }
      const linked = isGuardianLinkedToStudent(student.guardians, actor.userId, actor.email);
      if (!linked) {
        throw new ForbiddenException('You are not linked as a guardian for this student');
      }
    }
  }
}
