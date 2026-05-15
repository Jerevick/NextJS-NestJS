/** API may send `['*']` for SUPER_ADMIN — treat as all permissions. */
export function hasPermission(permissions: string[] | undefined, code: string): boolean {
  const p = permissions ?? [];
  return p.includes('*') || p.includes(code);
}

/** Institution portal: who may open the Billing area (aligns with API `assertBillingRead`). */
export function canAccessBillingNav(permissions: string[] | undefined): boolean {
  const p = permissions ?? [];
  return (
    p.includes('*') ||
    p.includes('billing.read') ||
    p.includes('billing.write') ||
    p.includes('institutions.read') ||
    p.includes('institutions.write')
  );
}
