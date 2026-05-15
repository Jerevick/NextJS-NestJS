import type { AuthUser } from '../auth/auth.types';

type InstitutionSettingsGrades = {
  grades?: {
    governance?: {
      /** Any of these permissions may set workflowStatus to APPROVED. */
      approvePermissionCodes?: string[];
      /** Any of these permissions may edit a grade that is already APPROVED. */
      postApprovalEditPermissionCodes?: string[];
    };
  };
};

const DEFAULT_APPROVE_CODES = ['grades.approve_board', 'grades.write'];
const DEFAULT_POST_APPROVAL_CODES = ['grades.write', 'grades.amend_approved'];

/**
 * Reads `Institution.settings` grade governance. Permission codes are OR‑combined: the user
 * needs any one code (or `*`).
 *
 * Defaults: final approval by **faculty board** (`grades.approve_board`) or admin override (`grades.write`);
 * post‑approval edits by **registrar / board amendments** (`grades.amend_approved`) or admin (`grades.write`).
 */
export function parseGradeGovernance(settings: unknown): {
  approvePermissionCodes: string[];
  postApprovalEditPermissionCodes: string[];
} {
  const root = (settings ?? {}) as InstitutionSettingsGrades;
  const gov = root.grades?.governance;

  const sanitize = (arr: unknown, fallback: string[]): string[] => {
    if (!Array.isArray(arr)) {
      return [...fallback];
    }
    const codes = arr.filter((x): x is string => typeof x === 'string' && x.length > 0);
    const unique = [...new Set(codes)];
    return unique.length > 0 ? unique : [...fallback];
  };

  return {
    approvePermissionCodes: sanitize(gov?.approvePermissionCodes, DEFAULT_APPROVE_CODES),
    postApprovalEditPermissionCodes: sanitize(
      gov?.postApprovalEditPermissionCodes,
      DEFAULT_POST_APPROVAL_CODES,
    ),
  };
}

export function userHasAnyPermission(user: AuthUser, permissionCodes: string[]): boolean {
  if (user.permissions.includes('*')) {
    return true;
  }
  return permissionCodes.some((p) => user.permissions.includes(p));
}
