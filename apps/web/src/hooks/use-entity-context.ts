'use client';

import { useSession } from 'next-auth/react';

export interface EntityContext {
  institutionId: string;
  entityId: string;
  entityScope: 'ALL' | 'ENTITY';
  accessToken: string | undefined;
  status: 'loading' | 'authenticated' | 'unauthenticated';
}

/**
 * Client hook for the active institution + campus (entity) from the NextAuth session.
 */
export function useEntityContext(): EntityContext {
  const { data, status } = useSession();
  const user = data?.user;
  const scope = user?.entityScope === 'ALL' ? 'ALL' : 'ENTITY';
  return {
    institutionId: user?.institutionId ?? '',
    entityId: user?.entityId ?? '',
    entityScope: scope,
    accessToken: data?.accessToken,
    status,
  };
}
