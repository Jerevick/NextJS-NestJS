import type { UserRole } from './generated-enums.js';

export type { UserRole };

/** Institution sub-unit scope (JWT + session). */
export type EntityScopeLevel = 'ALL' | 'ENTITY';

/** Access JWT payload (15m) */
export interface JwtAccessPayload {
  sub: string;
  email: string;
  role: UserRole;
  institutionId: string;
  /** Active campus / sub-institution for ENTITY-scoped users. */
  entityId?: string;
  entityScope?: EntityScopeLevel;
  /** Opaque id for access-token revocation (logout, blocklist). */
  jti?: string;
  /** Must match `User.sessionVersion` or the token is rejected (logout / inactivation). */
  sessionVersion?: number;
  permissions: string[];
  iat?: number;
  exp?: number;
}

/** Refresh token session stored in Redis + httpOnly cookie */
export interface JwtRefreshPayload {
  sub: string;
  institutionId: string;
  typ: 'refresh';
  jti: string;
  entityId?: string;
  entityScope?: EntityScopeLevel;
  sessionVersion?: number;
  iat?: number;
  exp?: number;
}
