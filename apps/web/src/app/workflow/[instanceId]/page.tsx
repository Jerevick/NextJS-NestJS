import Link from 'next/link';
import { notFound } from 'next/navigation';
import { auth } from '@/auth';
import { WorkflowActPanel } from '@/components/workflow/workflow-act-panel';
import { appendOptionalEntityHeader } from '@/lib/api-headers';

const apiBase = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export default async function WorkflowInstancePage({
  params,
}: {
  params: Promise<{ instanceId: string }>;
}) {
  const { instanceId } = await params;
  const session = await auth();
  if (!session?.accessToken || !session.user?.institutionId) {
    return (
      <main style={{ padding: '2rem' }}>
        <Link href="/login">Sign in</Link>
      </main>
    );
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${session.accessToken}`,
    'X-Institution-ID': session.user.institutionId,
  };
  appendOptionalEntityHeader(headers, session.user);

  const res = await fetch(`${apiBase}/workflow/instances/${instanceId}`, {
    headers,
    cache: 'no-store',
  });
  if (!res.ok) {
    notFound();
  }

  const instance = (await res.json()) as {
    id: string;
    definitionCode: string;
    status: string;
    currentStep: number;
    currentStepName: string | null;
    dueAt: string;
    history: unknown;
    metadata: Record<string, unknown>;
    currentAssigneeUserId: string | null;
    entity: { code: string; name: string };
    definition: { name: string; steps: unknown };
    initiator: { email: string };
  };

  const canAct = instance.currentAssigneeUserId === session.user.id;
  const history = Array.isArray(instance.history) ? instance.history : [];

  return (
    <main style={{ padding: '2rem', fontFamily: 'system-ui', maxWidth: 720 }}>
      <p style={{ marginTop: 0 }}>
        <Link href="/workflow/inbox" style={{ color: '#2563eb' }}>
          ← Inbox
        </Link>
      </p>
      <h1 style={{ marginTop: 0 }}>{instance.definition.name}</h1>
      <p style={{ color: '#64748b', fontSize: '0.9rem' }}>
        {instance.entity.name} ({instance.entity.code}) · {instance.status} · step{' '}
        {instance.currentStep}
      </p>
      <p style={{ fontSize: '0.88rem' }}>
        Initiated by {instance.initiator.email} · due {new Date(instance.dueAt).toLocaleString()}
      </p>

      <section style={{ marginTop: '1.5rem' }}>
        <h2 style={{ fontSize: '1rem' }}>History</h2>
        <ul style={{ fontSize: '0.88rem', paddingLeft: '1.25rem' }}>
          {history.map((h, i) => {
            const entry = h as { stepName?: string; action?: string; decidedAt?: string; notes?: string };
            return (
              <li key={i} style={{ marginBottom: 6 }}>
                <strong>{entry.stepName}</strong> — {entry.action} at{' '}
                {entry.decidedAt ? new Date(entry.decidedAt).toLocaleString() : '—'}
                {entry.notes ? ` (${entry.notes})` : ''}
              </li>
            );
          })}
        </ul>
      </section>

      <section style={{ marginTop: '1.5rem' }}>
        <h2 style={{ fontSize: '1rem' }}>Decision</h2>
        <WorkflowActPanel instanceId={instance.id} canAct={canAct} />
      </section>
    </main>
  );
}
