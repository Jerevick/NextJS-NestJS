import type { UserRole } from '@unicore/types';

export type AuthPosition = {
  code: string;
  level: number;
  scope: string;
  orgUnitId: string;
};

export type AuthUser = {
  userId: string;
  email: string;
  role: UserRole;
  institutionId: string;
  entityId: string;
  entityScope: 'ALL' | 'ENTITY';
  permissions: string[];
  position?: AuthPosition;
  /** Linked SIS student record when the user role is STUDENT and enrollment is ACTIVE. */
  studentId?: string;
  /** Present when the access JWT included a `jti` claim (used for explicit blocklist checks). */
  accessJti?: string;
};
