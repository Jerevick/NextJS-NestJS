import type { DefaultSession } from 'next-auth';

declare module 'next-auth' {
  interface Session {
    accessToken?: string;
    user: DefaultSession['user'] & {
      role: string;
      institutionId: string;
      permissions: string[];
      entityId: string;
      entityScope: 'ALL' | 'ENTITY';
      /** When true and entityScope is ALL, do not send X-Entity-ID (institution-wide UI focus). */
      omitEntityHeader?: boolean;
      /** Linked ACTIVE student record for student portal users. */
      studentId?: string;
    };
  }

  interface User {
    role?: string;
    institutionId?: string;
    permissions?: string[];
    entityId?: string;
    entityScope?: string;
    studentId?: string;
    /** Present after credentials login against the API; OAuth-only sessions may omit this. */
    accessToken?: string;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    role?: string;
    institutionId?: string;
    permissions?: string[];
    accessToken?: string;
    entityId?: string;
    entityScope?: string;
    omitEntityHeader?: boolean;
    studentId?: string;
  }
}
