/** Mirrors Prisma `UserRole` — keep in sync with packages/database schema */
export type UserRole =
  | 'SUPER_ADMIN'
  | 'ADMIN'
  | 'STAFF'
  | 'FACULTY'
  | 'STUDENT'
  | 'ALUMNI'
  | 'GUARDIAN';
