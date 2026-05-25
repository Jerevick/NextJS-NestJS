import type { DefaultSession } from 'next-auth';

declare module 'next-auth' {
  interface Session {
    accessToken?: string;
    authError?: 'SessionExpired';
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
      /** Institution terms and conditions have been accepted. */
      institutionTermsAccepted?: boolean;
      /** User must change temporary/generated password before normal app access. */
      forcePasswordChange?: boolean;
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
    /** Stored inside the encrypted NextAuth JWT only; never exposed on the browser session. */
    refreshToken?: string;
    institutionTermsAccepted?: boolean;
    forcePasswordChange?: boolean;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    role?: string;
    institutionId?: string;
    permissions?: string[];
    accessToken?: string;
    accessTokenExpires?: number;
    refreshToken?: string;
    authError?: 'SessionExpired';
    entityId?: string;
    entityScope?: string;
    omitEntityHeader?: boolean;
    studentId?: string;
    institutionTermsAccepted?: boolean;
    forcePasswordChange?: boolean;
  }
}
