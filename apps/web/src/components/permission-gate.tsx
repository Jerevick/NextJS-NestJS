'use client';

import type { ReactNode } from 'react';
import { usePermission } from '@/hooks/usePermission';

type PermissionGateProps = {
  permission: string;
  children: ReactNode;
  fallback?: ReactNode;
};

/** Renders `children` only when the session grants `permission` (or `*`). */
export function PermissionGate({ permission, children, fallback = null }: PermissionGateProps) {
  const allowed = usePermission(permission);
  if (!allowed) {
    return fallback;
  }
  return children;
}
