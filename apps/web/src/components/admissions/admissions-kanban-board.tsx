'use client';

import {
  closestCorners,
  DndContext,
  DragOverlay,
  PointerSensor,
  type DragEndEvent,
  type DragStartEvent,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Fragment, type ReactNode, useState, useTransition } from 'react';

import { patchApplicationKanbanStatus } from '@/app/admissions/actions';

export type AdmissionsKanbanRow = {
  id: string;
  status: string;
  applicantName: string;
  programLabel: string;
  cycleName: string;
  acceptedStudentId: string | null;
};

const COLUMN_ORDER = [
  'PENDING',
  'UNDER_REVIEW',
  'WAITLISTED',
  'ACCEPTED',
  'REJECTED',
  'WITHDRAWN',
] as const;

type ColumnStatus = (typeof COLUMN_ORDER)[number];

function statusLabel(status: string): string {
  switch (status) {
    case 'PENDING':
      return 'Applied';
    case 'UNDER_REVIEW':
      return 'Under review';
    case 'WAITLISTED':
      return 'Waitlisted';
    case 'ACCEPTED':
      return 'Accepted';
    case 'REJECTED':
      return 'Rejected';
    case 'WITHDRAWN':
      return 'Withdrawn';
    default:
      return status;
  }
}

function resolveDropColumn(
  overId: string,
  grouped: Record<string, AdmissionsKanbanRow[]>,
): string | null {
  if ((COLUMN_ORDER as readonly string[]).includes(overId)) {
    return overId;
  }
  for (const col of COLUMN_ORDER) {
    if (grouped[col]?.some((r) => r.id === overId)) {
      return col;
    }
  }
  return null;
}

function KanbanCardVisual({
  row,
  primary,
  mode,
}: {
  row: AdmissionsKanbanRow;
  primary: string;
  mode: 'card' | 'overlay';
}) {
  return (
    <div
      style={{
        border: '1px solid #e2e8f0',
        borderRadius: 10,
        padding: '0.65rem 0.75rem',
        marginBottom: mode === 'overlay' ? 0 : 8,
        background: '#ffffff',
        boxShadow: mode === 'overlay' ? '0 12px 36px rgb(15 23 42 / 0.18)' : 'none',
        cursor: mode === 'overlay' ? 'grabbing' : undefined,
      }}
    >
      <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: 4 }}>
        {row.applicantName}
      </div>
      <div style={{ fontSize: '0.78rem', color: '#64748b', lineHeight: 1.35 }}>
        {row.programLabel}
      </div>
      <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: 4 }}>{row.cycleName}</div>
      {row.acceptedStudentId ? (
        <div
          style={{
            marginTop: 8,
            display: 'inline-block',
            fontSize: '0.7rem',
            fontWeight: 600,
            color: '#0f766e',
            background: '#ccfbf1',
            padding: '0.15rem 0.45rem',
            borderRadius: 999,
          }}
        >
          Enrolled
        </div>
      ) : null}
      {mode === 'card' ? (
        <div style={{ marginTop: 10 }}>
          <Link
            href={`/admissions/${row.id}`}
            style={{ fontSize: '0.78rem', fontWeight: 600, color: primary }}
          >
            Open →
          </Link>
        </div>
      ) : (
        <div style={{ marginTop: 10, fontSize: '0.78rem', fontWeight: 600, color: primary }}>
          Drag to column…
        </div>
      )}
    </div>
  );
}

function KanbanCard({
  row,
  canWrite,
  primary,
}: {
  row: AdmissionsKanbanRow;
  canWrite: boolean;
  primary: string;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: row.id,
    data: { type: 'card', status: row.status },
    disabled: !canWrite,
  });

  const style = transform
    ? {
        transform: CSS.Translate.toString(transform),
      }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={{
        ...style,
        opacity: isDragging ? 0.28 : 1,
        cursor: canWrite ? 'grab' : 'default',
        touchAction: 'none',
      }}
    >
      <KanbanCardVisual row={row} primary={primary} mode="card" />
    </div>
  );
}

function DroppableColumn({
  status,
  children,
  muted,
}: {
  status: ColumnStatus;
  children: ReactNode;
  muted: string;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status, data: { type: 'column' } });

  return (
    <div
      ref={setNodeRef}
      style={{
        minWidth: 220,
        maxWidth: 280,
        flex: '1 1 220px',
        border: `1px solid ${isOver ? '#94a3b8' : '#e2e8f0'}`,
        borderRadius: 12,
        background: isOver ? '#f8fafc' : '#f1f5f9',
        padding: '0.65rem',
        alignSelf: 'stretch',
      }}
    >
      <div
        style={{
          fontWeight: 700,
          fontSize: '0.85rem',
          color: muted,
          marginBottom: '0.5rem',
          display: 'flex',
          justifyContent: 'space-between',
          gap: '0.5rem',
          alignItems: 'baseline',
        }}
      >
        <span>{statusLabel(status)}</span>
      </div>
      {children}
    </div>
  );
}

export function AdmissionsKanbanBoard({
  rows,
  canWrite,
  footnote,
}: {
  rows: AdmissionsKanbanRow[];
  canWrite: boolean;
  footnote?: string;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const primary = '#1e3a5f';
  const muted = '#64748b';
  const [dragId, setDragId] = useState<string | null>(null);

  const grouped: Record<string, AdmissionsKanbanRow[]> = COLUMN_ORDER.reduce(
    (acc, key) => {
      acc[key] = [];
      return acc;
    },
    {} as Record<string, AdmissionsKanbanRow[]>,
  );
  for (const r of rows) {
    const col = (COLUMN_ORDER as readonly string[]).includes(r.status) ? r.status : 'PENDING';
    grouped[col]!.push({ ...r, status: col });
  }

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const dragRow = dragId ? rows.find((r) => r.id === dragId) : undefined;

  async function finishDrag(ev: DragEndEvent) {
    try {
      if (!canWrite || !ev.over) return;
      const activeId = String(ev.active.id);
      const overId = String(ev.over.id);
      const from = ev.active.data.current?.status as string | undefined;
      const targetColumn = resolveDropColumn(overId, grouped);
      if (!from || !targetColumn || from === targetColumn) return;

      const err = await patchApplicationKanbanStatus(activeId, targetColumn);
      if (err?.error) {
        window.alert(err.error);
        return;
      }
      startTransition(() => router.refresh());
    } catch {
      window.alert('Update failed unexpectedly.');
    } finally {
      setDragId(null);
    }
  }

  return (
    <section style={{ marginTop: '2rem' }}>
      <h2
        style={{ fontFamily: '"Crimson Pro", Georgia, serif', fontSize: '1.35rem', color: primary }}
      >
        Pipeline board
      </h2>
      <p
        style={{ color: muted, fontSize: '0.9rem', marginTop: '-0.25rem', marginBottom: '0.65rem' }}
      >
        {canWrite
          ? 'Drag a card between columns to update application status.'
          : 'Read-only — requires admissions.write to drag.'}
      </p>
      {footnote ? (
        <p
          style={{ color: muted, fontSize: '0.82rem', marginTop: '-0.4rem', marginBottom: '1rem' }}
        >
          {footnote}
        </p>
      ) : null}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={(e: DragStartEvent) => setDragId(String(e.active.id))}
        onDragCancel={() => setDragId(null)}
        onDragEnd={(e: DragEndEvent) => void finishDrag(e)}
      >
        <div
          style={{ display: 'flex', flexWrap: 'wrap', gap: '0.85rem', alignItems: 'flex-start' }}
        >
          {COLUMN_ORDER.map((col) => (
            <Fragment key={col}>
              <DroppableColumn status={col} muted={muted}>
                {grouped[col]!.length === 0 ? (
                  <div
                    style={{
                      fontSize: '0.8rem',
                      color: '#cbd5e1',
                      padding: '0.75rem',
                      textAlign: 'center',
                    }}
                  >
                    Drop here
                  </div>
                ) : (
                  grouped[col]!.map((row) => (
                    <KanbanCard key={row.id} row={row} canWrite={canWrite} primary={primary} />
                  ))
                )}
              </DroppableColumn>
            </Fragment>
          ))}
        </div>
        <DragOverlay dropAnimation={null}>
          {dragRow ? <KanbanCardVisual row={dragRow} primary={primary} mode="overlay" /> : null}
        </DragOverlay>
      </DndContext>
    </section>
  );
}
