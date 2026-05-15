'use client';

import { useSession } from 'next-auth/react';

/** True if the current session includes the permission or wildcard `*`. */
export function usePermission(permission: string): boolean {
  const { data } = useSession();
  const perms = data?.user?.permissions ?? [];
  return perms.includes('*') || perms.includes(permission);
}
