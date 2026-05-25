'use client';

import type { ReactNode } from 'react';
import { useEntityContext } from '@/hooks/use-entity-context';

export function EntityScopeGate({
  scope,
  children,
  fallback = null,
}: {
  scope: 'ALL';
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const { entityScope } = useEntityContext();
  if (entityScope !== scope) {
    return <>{fallback}</>;
  }
  return <>{children}</>;
}
