import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { ENROLLMENT_CREATED, type EnrollmentCreatedEvent } from '../events/enrollment.events';
import { FinanceEnrollmentChargesService } from './finance-enrollment-charges.service';

@Injectable()
export class FinanceEnrollmentListener {
  private readonly log = new Logger(FinanceEnrollmentListener.name);

  constructor(private readonly financeCharges: FinanceEnrollmentChargesService) {}

  @OnEvent(ENROLLMENT_CREATED, { async: true })
  async onEnrollmentCreated(payload: EnrollmentCreatedEvent) {
    try {
      await this.financeCharges.applyEnrollmentFees({
        institutionId: payload.institutionId,
        entityId: payload.entityId,
        studentId: payload.studentId,
        programId: payload.programId,
        semesterId: payload.semesterId,
        courseCode: payload.courseCode,
        enrollmentId: payload.enrollmentId,
        actorUserId: payload.actorUserId,
      });
    } catch (err) {
      this.log.warn(
        `Enrollment finance auto-charge failed for ${payload.enrollmentId}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }
}
