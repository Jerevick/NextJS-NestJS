'use client';

import { useSession } from 'next-auth/react';

export function usePermission(permission: string): boolean {
  const { data } = useSession();
  const perms = data?.user?.permissions ?? [];
  return perms.includes('*') || perms.includes(permission);
}
