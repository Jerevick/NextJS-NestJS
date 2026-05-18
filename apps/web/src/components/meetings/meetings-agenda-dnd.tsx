'use client';

import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useEffect, useState, useTransition } from 'react';
import { reorderAgendaAction } from '@/app/meetings/actions';

type AgendaItem = { id: string; itemNumber: string; title: string; order: number };

function SortableAgendaRow({ item, disabled }: { item: AgendaItem; disabled?: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
    disabled,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.85 : 1,
  };

  return (
    <li
      ref={setNodeRef}
      style={{
        ...style,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '0.5rem 0',
        borderBottom: '1px solid #f1f5f9',
        listStyle: 'none',
      }}
    >
      <button
        type="button"
        aria-label="Drag to reorder"
        disabled={disabled}
        {...attributes}
        {...listeners}
        style={{
          cursor: disabled ? 'not-allowed' : 'grab',
          border: '1px solid #cbd5e1',
          borderRadius: 6,
          background: '#f8fafc',
          padding: '0.15rem 0.4rem',
          fontSize: '0.75rem',
        }}
      >
        ⋮⋮
      </button>
      <span style={{ fontWeight: 600, minWidth: 28 }}>{item.itemNumber}</span>
      <span>{item.title}</span>
    </li>
  );
}

export function MeetingsAgendaDnd({
  meetingId,
  items: initial,
  disabled,
  onReordered,
}: {
  meetingId: string;
  items: AgendaItem[];
  disabled?: boolean;
  onReordered?: () => void;
}) {
  const [items, setItems] = useState(() => [...initial].sort((a, b) => a.order - b.order));

  useEffect(() => {
    setItems([...initial].sort((a, b) => a.order - b.order));
  }, [initial]);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = items.findIndex((i) => i.id === active.id);
    const newIndex = items.findIndex((i) => i.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const next = arrayMove(items, oldIndex, newIndex);
    setItems(next);
    startTransition(async () => {
      const r = await reorderAgendaAction(
        meetingId,
        next.map((i) => i.id),
      );
      if (r.error) setError(r.error);
      else {
        setError(null);
        onReordered?.();
      }
    });
  };

  if (!items.length) {
    return <p style={{ color: '#64748b', fontSize: '0.9rem' }}>No agenda items yet.</p>;
  }

  return (
    <div>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
          <ul style={{ margin: 0, padding: 0 }}>
            {items.map((item) => (
              <SortableAgendaRow key={item.id} item={item} disabled={disabled || pending} />
            ))}
          </ul>
        </SortableContext>
      </DndContext>
      {error ? <p style={{ color: '#b91c1c', fontSize: '0.85rem' }}>{error}</p> : null}
    </div>
  );
}
