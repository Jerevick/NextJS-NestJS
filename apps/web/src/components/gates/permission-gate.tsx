'use client';

import type { ReactNode } from 'react';
import { usePermission } from '@/hooks/use-permission';

export function PermissionGate({
  permission,
  children,
  fallback = null,
}: {
  permission: string;
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const allowed = usePermission(permission);
  if (!allowed) {
    return <>{fallback}</>;
  }
  return <>{children}</>;
}
