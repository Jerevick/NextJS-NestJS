import type { UserRole } from '@unicore/types';

export type AuthUser = {
  userId: string;
  email: string;
  role: UserRole;
  institutionId: string;
  entityId: string;
  entityScope: 'ALL' | 'ENTITY';
  permissions: string[];
  /** Present when the access JWT included a `jti` claim (used for explicit blocklist checks). */
  accessJti?: string;
};
