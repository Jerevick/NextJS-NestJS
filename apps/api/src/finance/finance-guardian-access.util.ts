/**
 * Student.guardians JSON may be an array of user ids or objects with userId / email.
 */
export function isGuardianLinkedToStudent(
  guardians: unknown,
  guardianUserId: string,
  guardianEmail?: string | null,
): boolean {
  if (!Array.isArray(guardians) || guardians.length === 0) {
    return false;
  }
  const emailNorm = guardianEmail?.trim().toLowerCase();
  for (const entry of guardians) {
    if (typeof entry === 'string' && entry.trim() === guardianUserId) {
      return true;
    }
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      continue;
    }
    const o = entry as Record<string, unknown>;
    const uid = typeof o.userId === 'string' ? o.userId : typeof o.id === 'string' ? o.id : null;
    if (uid === guardianUserId) {
      return true;
    }
    if (emailNorm && typeof o.email === 'string' && o.email.trim().toLowerCase() === emailNorm) {
      return true;
    }
  }
  return false;
}
