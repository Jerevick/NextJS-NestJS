'use client';

import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';

const INSTITUTION_WIDE = '__INSTITUTION_WIDE__';

const apiBase = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export function EntitySwitcher({
  entities,
}: {
  entities: Array<{ id: string; name: string; code?: string; billableStudentCount?: number }>;
}) {
  const { data: session, status, update } = useSession();
  const router = useRouter();

  if (status !== 'authenticated' || !session || entities.length === 0) {
    return null;
  }

  const canInstitutionWide = session.user.entityScope === 'ALL';

  async function switchToCampus(entityId: string): Promise<void> {
    if (!session) {
      return;
    }
    const token = session.accessToken;
    const inst = session.user.institutionId;
    if (!token || !inst) {
      return;
    }
    const res = await fetch(`${apiBase}/auth/switch-entity`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        'X-Institution-ID': inst,
      },
      body: JSON.stringify({ entityId }),
    });
    if (!res.ok) {
      return;
    }
    const body = (await res.json()) as {
      accessToken: string;
      user: { entityId?: string; entityScope?: string };
    };
    await update({
      accessToken: body.accessToken,
      entityId: body.user.entityId ?? entityId,
      entityScope: body.user.entityScope,
      omitEntityHeader: false,
    });
    router.refresh();
  }

  async function onSelect(raw: string): Promise<void> {
    if (!session?.accessToken || !session.user.institutionId) {
      return;
    }
    if (raw === INSTITUTION_WIDE) {
      await update({ omitEntityHeader: true });
      router.refresh();
      return;
    }
    await switchToCampus(raw);
  }

  const selectValue = session.user.omitEntityHeader ? INSTITUTION_WIDE : session.user.entityId;

  return (
    <motion.label
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      style={{ display: 'block', marginTop: '1rem' }}
    >
      <span style={{ display: 'block', fontSize: '0.85rem', color: '#64748b', marginBottom: '0.35rem' }}>
        Switch campus
      </span>
      <select
        key={`${selectValue}-${session.user.omitEntityHeader ? 1 : 0}`}
        value={selectValue}
        onChange={(e) => void onSelect(e.target.value)}
        style={{ minWidth: 300, padding: '0.45rem 0.5rem' }}
      >
        {canInstitutionWide ? (
          <option value={INSTITUTION_WIDE}>All entities (institution-wide)</option>
        ) : null}
        {entities.map((e) => (
          <option key={e.id} value={e.id}>
            {e.name}
            {typeof e.billableStudentCount === 'number' ? ` · ${e.billableStudentCount} ACTIVE` : ''}
          </option>
        ))}
      </select>
    </motion.label>
  );
}
