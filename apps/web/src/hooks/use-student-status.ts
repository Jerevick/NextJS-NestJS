'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';

const apiBase =
  process.env.NEXT_PUBLIC_API_URL ?? process.env.AUTH_API_URL ?? 'http://localhost:4000';

export type StudentStatusState = {
  isActive: boolean;
  status: string;
  inactiveReason: string | null;
  canPostRecords: boolean;
  loading: boolean;
};

/**
 * Fetches enrollment status for a student — drives read-only UI (Prompt 1.3).
 */
export function useStudentStatus(studentId: string | undefined): StudentStatusState {
  const { data: session } = useSession();
  const [state, setState] = useState<StudentStatusState>({
    isActive: true,
    status: 'ACTIVE',
    inactiveReason: null,
    canPostRecords: true,
    loading: Boolean(studentId),
  });

  const load = useCallback(async () => {
    if (!studentId || !session?.accessToken) {
      setState((s) => ({ ...s, loading: false }));
      return;
    }
    setState((s) => ({ ...s, loading: true }));
    try {
      const res = await fetch(`${apiBase}/students/${studentId}`, {
        headers: { Authorization: `Bearer ${session.accessToken}` },
      });
      if (!res.ok) {
        setState((s) => ({ ...s, loading: false, canPostRecords: false }));
        return;
      }
      const body = (await res.json()) as {
        enrollmentStatus?: string;
        inactiveReason?: string | null;
      };
      const status = body.enrollmentStatus ?? 'ACTIVE';
      const isActive = status === 'ACTIVE';
      setState({
        isActive,
        status,
        inactiveReason: body.inactiveReason ?? null,
        canPostRecords: isActive,
        loading: false,
      });
    } catch {
      setState((s) => ({ ...s, loading: false, canPostRecords: false }));
    }
  }, [studentId, session?.accessToken]);

  useEffect(() => {
    void load();
  }, [load]);

  return state;
}
