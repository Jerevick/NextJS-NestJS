import type { Student } from '@prisma/client';

export type ElectionEligibilityRules = {
  roles?: string[];
  enrollmentStatuses?: string[];
  minLevel?: number;
  maxLevel?: number;
  programmeIds?: string[];
  entityIds?: string[];
};

export function parseEligibilityRules(raw: unknown): ElectionEligibilityRules {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const r = raw as Record<string, unknown>;
  return {
    roles: Array.isArray(r.roles) ? r.roles.map(String) : undefined,
    enrollmentStatuses: Array.isArray(r.enrollmentStatuses)
      ? r.enrollmentStatuses.map(String)
      : undefined,
    minLevel: typeof r.minLevel === 'number' ? r.minLevel : undefined,
    maxLevel: typeof r.maxLevel === 'number' ? r.maxLevel : undefined,
    programmeIds: Array.isArray(r.programmeIds) ? r.programmeIds.map(String) : undefined,
    entityIds: Array.isArray(r.entityIds) ? r.entityIds.map(String) : undefined,
  };
}

export function studentMeetsEligibility(
  student: Pick<Student, 'enrollmentStatus' | 'currentLevel' | 'programId' | 'entityId'>,
  rules: ElectionEligibilityRules,
  opts?: { electionEntityId?: string; electionScope?: 'ENTITY' | 'INSTITUTION' },
): boolean {
  if (opts?.electionScope === 'ENTITY' && opts.electionEntityId) {
    if (student.entityId !== opts.electionEntityId) return false;
  }
  if (rules.enrollmentStatuses?.length) {
    if (!rules.enrollmentStatuses.includes(student.enrollmentStatus)) return false;
  }
  if (rules.minLevel != null && student.currentLevel < rules.minLevel) return false;
  if (rules.maxLevel != null && student.currentLevel > rules.maxLevel) return false;
  if (rules.programmeIds?.length && !rules.programmeIds.includes(student.programId)) return false;
  if (rules.entityIds?.length && !rules.entityIds.includes(student.entityId)) return false;
  return true;
}
