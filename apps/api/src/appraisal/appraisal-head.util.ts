/** Position codes tried in order when resolving a staff member's immediate head. */
export const DEFAULT_IMMEDIATE_HEAD_POSITION_CODES = [
  'PC',
  'LM',
  'LINE_MANAGER',
  'SUPERVISOR',
] as const;

export type RoleExpectations = {
  duties: string[];
  responsibilities: string[];
  positionCode?: string;
  positionTitle?: string;
};

export function resolveRoleExpectationsFromHr(
  hr: Record<string, unknown>,
  positionCode: string,
  positionLevel: number,
): RoleExpectations {
  const byCode = (hr.roleExpectationsByPositionCode as Record<string, RoleExpectations>) ?? {};
  const byLevel = (hr.roleExpectationsByPositionLevel as Record<string, RoleExpectations>) ?? {};
  const fallback = (hr.defaultRoleExpectations as RoleExpectations) ?? {
    duties: [],
    responsibilities: [],
  };
  const picked = byCode[positionCode] ?? byLevel[String(positionLevel)] ?? fallback;
  return {
    duties: [...(picked.duties ?? [])],
    responsibilities: [...(picked.responsibilities ?? [])],
    positionCode,
  };
}

export function immediateHeadPositionCodes(hr: Record<string, unknown>): string[] {
  const custom = hr.immediateHeadPositionCodes;
  if (Array.isArray(custom) && custom.every((c) => typeof c === 'string')) {
    return custom as string[];
  }
  return [...DEFAULT_IMMEDIATE_HEAD_POSITION_CODES];
}
