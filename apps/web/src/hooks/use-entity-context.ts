'use client';

import { useRouter } from 'next/navigation';
import { useCallback } from 'react';
import { useSession } from 'next-auth/react';

const apiBase = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export interface EntityContext {
  institutionId: string;
  entityId: string;
  entityScope: 'ALL' | 'ENTITY';
  accessToken: string | undefined;
  canSeeAllEntities: boolean;
  status: 'loading' | 'authenticated' | 'unauthenticated';
  switchEntity: (targetEntityId: string) => Promise<boolean>;
}

/**
 * Client hook for the active institution + campus (entity) from the NextAuth session.
 */
export function useEntityContext(): EntityContext {
  const { data, status, update } = useSession();
  const router = useRouter();
  const user = data?.user;
  const scope = user?.entityScope === 'ALL' ? 'ALL' : 'ENTITY';

  const switchEntity = useCallback(
    async (targetEntityId: string): Promise<boolean> => {
      if (!data?.accessToken || !user?.institutionId) {
        return false;
      }
      const res = await fetch(`${apiBase}/auth/switch-entity`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${data.accessToken}`,
          'X-Institution-ID': user.institutionId,
        },
        body: JSON.stringify({ entityId: targetEntityId }),
      });
      if (!res.ok) {
        return false;
      }
      const body = (await res.json()) as {
        accessToken: string;
        refreshToken?: string;
        user: { entityId?: string; entityScope?: string };
      };
      await update({
        accessToken: body.accessToken,
        refreshToken: body.refreshToken,
        entityId: body.user.entityId ?? targetEntityId,
        entityScope: body.user.entityScope,
        omitEntityHeader: false,
      });
      router.refresh();
      return true;
    },
    [data?.accessToken, router, update, user?.institutionId],
  );

  return {
    institutionId: user?.institutionId ?? '',
    entityId: user?.entityId ?? '',
    entityScope: scope,
    accessToken: data?.accessToken,
    canSeeAllEntities: scope === 'ALL',
    status,
    switchEntity,
  };
}
