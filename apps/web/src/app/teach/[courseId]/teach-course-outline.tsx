'use client';

import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Button,
  Divider,
  Link,
  Stack,
  Typography,
} from '@mui/material';
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
import NextLink from 'next/link';
import { Fragment, useState, useTransition, type CSSProperties, type ReactElement } from 'react';

import type { LMSCourseModule, LMSLesson } from '@/components/lms/course-structure';

import { reorderLmsLessonsAction, reorderLmsModulesAction } from './actions';

type Props = {
  courseInstanceId: string;
  modules: LMSCourseModule[];
  selectedLessonId?: string | null;
  onSelectLesson?: (lesson: LMSLesson, moduleId: string, moduleTitle: string) => void;
};

function SortableModuleRow({
  id,
  children,
}: {
  id: string;
  children: (listeners: Record<string, unknown> | undefined, style: CSSProperties) => ReactElement;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.92 : 1,
  };

  return (
    <Box ref={setNodeRef} {...attributes}>
      {children(listeners as Record<string, unknown> | undefined, style)}
    </Box>
  );
}

function lessonTypeLabel(lessonType: LMSLesson['type']) {
  const t = lessonType.toUpperCase();
  if (t === 'VIDEO') {
    return 'Video';
  }
  if (t === 'TEXT' || t === 'DOCUMENT') {
    return 'Reading';
  }
  if (t === 'EMBED') {
    return 'Embed';
  }
  return lessonType;
}

export default function TeachCourseOutline({
  courseInstanceId,
  modules: initial,
  selectedLessonId,
  onSelectLesson,
}: Props) {
  const [modulesState, setModulesState] = useState<LMSCourseModule[]>(() =>
    [...initial].map((m) => ({ ...m, lessons: m.lessons.map((l) => ({ ...l })) })),
  );
  const [busy, startTransition] = useTransition();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const moduleIds = modulesState.map((m) => m.id);

  const handleModulesDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) {
      return;
    }
    const oldIndex = moduleIds.indexOf(String(active.id));
    const newIndex = moduleIds.indexOf(String(over.id));
    if (oldIndex < 0 || newIndex < 0) {
      return;
    }

    const previous = [...modulesState].map((m) => ({
      ...m,
      lessons: m.lessons.map((l) => ({ ...l })),
    }));
    const optimistic = arrayMove(modulesState, oldIndex, newIndex);
    const nextOrderedIds = optimistic.map((m) => m.id);

    setModulesState(optimistic);
    startTransition(() => {
      void reorderLmsModulesAction(courseInstanceId, nextOrderedIds).then((r) => {
        if (!r.ok) {
          setModulesState(previous);
        }
      });
    });
  };

  const moveLesson = (moduleIndex: number, lessonIndex: number, dir: 'up' | 'down') => {
    const mod = modulesState[moduleIndex];
    if (!mod) return;

    const nextIndex = lessonIndex + (dir === 'up' ? -1 : 1);
    if (nextIndex < 0 || nextIndex >= mod.lessons.length) return;

    const previousAll = modulesState.map((m) => ({
      ...m,
      lessons: m.lessons.map((l) => ({ ...l })),
    }));

    const lessons = [...mod.lessons];
    const tmp = lessons[lessonIndex];
    const swapped = lessons[nextIndex];
    if (!tmp || !swapped) return;
    lessons[lessonIndex] = swapped;
    lessons[nextIndex] = tmp;

    const nextModules = modulesState.map((m, mi) =>
      mi === moduleIndex ? { ...m, lessons } : { ...m, lessons: [...m.lessons] },
    );
    const lessonIds = lessons.map((l) => l.id);

    setModulesState(nextModules);
    startTransition(() => {
      void reorderLmsLessonsAction(courseInstanceId, mod.id, lessonIds).then((r) => {
        if (!r.ok) setModulesState(previousAll);
      });
    });
  };

  return (
    <Stack spacing={1.75}>
      <Typography variant="body2" color="text.secondary">
        Drag modules by the grip. Reorder lessons within a module using the arrows (same API as full
        lesson drag-and-drop, optimized for predictable nested lists).
      </Typography>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleModulesDragEnd}
      >
        <SortableContext items={moduleIds} strategy={verticalListSortingStrategy}>
          <Stack spacing={1.25}>
            {modulesState.map((mod, moduleIndex) => (
              <SortableModuleRow key={mod.id} id={mod.id}>
                {(listeners, rowStyle) => (
                  <Box style={rowStyle}>
                    <Accordion
                      elevation={2}
                      defaultExpanded={moduleIndex === 0}
                      disableGutters
                      sx={{
                        borderRadius: 2,
                        border: (t) => `1px solid ${t.palette.divider}`,
                        '&:before': { display: 'none' },
                      }}
                    >
                      <AccordionSummary
                        sx={{
                          '& .MuiAccordionSummary-expandIconWrapper': {
                            alignSelf: 'flex-start',
                            mt: 0.85,
                          },
                        }}
                      >
                        <Stack direction="row" spacing={1} alignItems="flex-start">
                          <Button
                            size="small"
                            variant="text"
                            aria-label="Drag module"
                            sx={{ minWidth: 40, px: 0.5, fontWeight: 800, letterSpacing: 2 }}
                            {...(listeners ?? {})}
                          >
                            ::
                          </Button>
                          <Box sx={{ minWidth: 0 }}>
                            <Typography variant="subtitle1" sx={{ fontWeight: 950 }}>
                              {mod.title.trim() || '(Untitled module)'}
                            </Typography>
                          </Box>
                        </Stack>
                      </AccordionSummary>

                      <AccordionDetails>
                        <Divider sx={{ mb: 1.25 }} />
                        {mod.lessons.length <= 0 ? (
                          <Typography variant="body2" color="text.secondary">
                            No lessons in this module yet.
                          </Typography>
                        ) : (
                          <Stack spacing={1}>
                            {mod.lessons.map((lesson, lessonIndex) => (
                              <Fragment key={lesson.id}>
                                <Stack
                                  direction={{ xs: 'column', md: 'row' }}
                                  spacing={{ xs: 1, md: 1.25 }}
                                  alignItems={{ xs: 'stretch', md: 'center' }}
                                  justifyContent="space-between"
                                  sx={{
                                    border: (t) =>
                                      lesson.id === selectedLessonId
                                        ? `2px solid ${t.palette.primary.main}`
                                        : `1px solid ${t.palette.divider}`,
                                    borderRadius: 2,
                                    p: { xs: 1.05, md: 1 },
                                    bgcolor:
                                      lesson.id === selectedLessonId
                                        ? 'action.hover'
                                        : 'background.paper',
                                  }}
                                >
                                  <Box
                                    sx={{
                                      minWidth: 0,
                                      flex: 1,
                                      cursor: onSelectLesson ? 'pointer' : undefined,
                                      pr: onSelectLesson ? 0 : undefined,
                                    }}
                                    onClick={() => onSelectLesson?.(lesson, mod.id, mod.title)}
                                  >
                                    <Typography variant="body2" color="text.secondary">
                                      Lesson {lessonIndex + 1} · {lessonTypeLabel(lesson.type)}
                                    </Typography>
                                    <Typography sx={{ mt: 0.25 }}>
                                      <NextLink
                                        href={`/dashboard/courses/${courseInstanceId}/lessons/${lesson.id}`}
                                        passHref
                                        legacyBehavior
                                        prefetch={false}
                                      >
                                        <Link
                                          underline="hover"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                          }}
                                        >
                                          {lesson.title.trim()}
                                        </Link>
                                      </NextLink>
                                    </Typography>
                                  </Box>

                                  <Stack
                                    direction="row"
                                    spacing={0.5}
                                    sx={{
                                      justifyContent: { xs: 'flex-end', md: 'flex-start' },
                                      flexShrink: 0,
                                    }}
                                  >
                                    <Button
                                      size="small"
                                      variant="outlined"
                                      disabled={lessonIndex <= 0 || busy}
                                      onClick={() => moveLesson(moduleIndex, lessonIndex, 'up')}
                                      aria-label="Move lesson up"
                                    >
                                      ↑
                                    </Button>
                                    <Button
                                      size="small"
                                      variant="outlined"
                                      disabled={lessonIndex >= mod.lessons.length - 1 || busy}
                                      onClick={() => moveLesson(moduleIndex, lessonIndex, 'down')}
                                      aria-label="Move lesson down"
                                    >
                                      ↓
                                    </Button>
                                  </Stack>
                                </Stack>
                              </Fragment>
                            ))}
                          </Stack>
                        )}
                      </AccordionDetails>
                    </Accordion>
                  </Box>
                )}
              </SortableModuleRow>
            ))}
          </Stack>
        </SortableContext>
      </DndContext>
    </Stack>
  );
}
