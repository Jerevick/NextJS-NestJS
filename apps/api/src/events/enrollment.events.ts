/** Emitted when a student enrollment row is created or revived (ACTIVE). */
export const ENROLLMENT_CREATED = 'enrollment.created';

export type EnrollmentCreatedEvent = {
  institutionId: string;
  entityId: string;
  studentId: string;
  programId: string;
  semesterId: string;
  courseCode: string;
  enrollmentId: string;
  actorUserId?: string;
};
