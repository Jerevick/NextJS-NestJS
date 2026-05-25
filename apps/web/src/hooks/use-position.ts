'use client';

import { useSession } from 'next-auth/react';

export type PositionContext = {
  code: string | undefined;
  level: number | undefined;
  scope: string | undefined;
  orgUnitId: string | undefined;
};

export function usePosition(): PositionContext {
  const { data } = useSession();
  const position = (data?.user as { position?: PositionContext } | undefined)?.position;
  return {
    code: position?.code,
    level: position?.level,
    scope: position?.scope,
    orgUnitId: position?.orgUnitId,
  };
}
