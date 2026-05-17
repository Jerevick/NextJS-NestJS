import { Injectable } from '@nestjs/common';
import type { AuthUser } from '../auth/auth.types';
import { ProgressionService } from '../progression/progression.service';
import type { CreateEnrollmentDto } from './dto/create-enrollment.dto';

type StudentForRepeatCheck = {
  id: string;
  programId: string;
  admissionDate: Date | null;
  program: { durationYears: number };
};

/**
 * Centralises LAW P2 / repeat limits for {@link EnrollmentService.create} (used by HTTP and bulk paths).
 */
@Injectable()
export class RepeatEnrollmentGuard {
  constructor(private readonly progression: ProgressionService) {}

  async assertWithinLimits(
    actor: AuthUser,
    dto: CreateEnrollmentDto,
    student: StudentForRepeatCheck,
  ): Promise<void> {
    const attempt = dto.enrollmentAttemptNumber ?? 1;
    const originalSemesterId = dto.originalSemesterId?.trim()
      ? dto.originalSemesterId.trim()
      : null;
    await this.progression.assertEnrollmentWithinProgressionLimits({
      institutionId: actor.institutionId,
      student: {
        id: student.id,
        programId: student.programId,
        admissionDate: student.admissionDate,
        program: student.program,
      },
      enrollmentAttemptNumber: attempt,
      originalSemesterId,
    });
  }
}
