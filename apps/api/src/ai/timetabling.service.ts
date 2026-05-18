import { Injectable, NotFoundException } from '@nestjs/common';
import type { AuthUser } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { parseSectionSchedule } from '../enrollment/timetable-conflict.util';
import {
  generateTimetableOptions,
  type TimetableEngineInput,
  type TimetableEngineOption,
} from './timetabling-engine.util';
import { AiService } from './ai.service';
import {
  mergeConstraintGrid,
  parseTimetableConstraints,
  type ParsedTimetableConstraints,
} from './timetable-constraints.util';

@Injectable()
export class TimetablingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiService,
  ) {}

  generate(
    input: TimetableEngineInput,
    constraints?: string[],
  ): {
    options: TimetableEngineOption[];
    engine: 'csp';
    constraintsApplied: ParsedTimetableConstraints;
    isAIGenerated: false;
  } {
    const constraintsApplied = parseTimetableConstraints(constraints);
    const merged: TimetableEngineInput = {
      ...input,
      slotGrid: mergeConstraintGrid(input.slotGrid, constraintsApplied),
      constraintNotes: constraintsApplied.notes,
    };
    const options = generateTimetableOptions(merged);
    return { options, engine: 'csp', constraintsApplied, isAIGenerated: false };
  }

  async generateForSemester(
    user: AuthUser,
    semesterId: string,
    entityId?: string,
    opts?: {
      onlyUnscheduled?: boolean;
      maxOptions?: number;
      constraints?: string[];
      facultyAvailability?: Record<string, string[]>;
    },
  ) {
    const semester = await this.prisma.semester.findFirst({
      where: { id: semesterId, institutionId: user.institutionId },
    });
    if (!semester) throw new NotFoundException('Semester not found');

    const sectionWhere = {
      institutionId: user.institutionId,
      semesterId,
      deletedAt: null,
      ...(entityId ? { entityId } : {}),
    };

    const sections = await this.prisma.section.findMany({
      where: sectionWhere,
      include: {
        course: { select: { code: true } },
        enrollments: {
          where: { deletedAt: null, status: 'ENROLLED' },
          select: { studentId: true },
        },
      },
    });

    const rooms = await this.prisma.room.findMany({
      where: { institutionId: user.institutionId, deletedAt: null },
      select: { id: true, capacity: true },
    });

    const toSchedule = sections.filter((s) => {
      if (!opts?.onlyUnscheduled) return true;
      return parseSectionSchedule(s.schedule).length === 0;
    });

    const existing = sections
      .filter((s) => parseSectionSchedule(s.schedule).length > 0)
      .map((s) => ({
        sectionId: s.id,
        courseCode: s.course.code,
        instructorId: s.instructorId ?? undefined,
        roomId: s.room ?? undefined,
        schedule: s.schedule,
      }));

    const studentOverlapGroups = this.buildOverlapGroups(
      toSchedule.map((s) => ({
        id: s.id,
        studentIds: s.enrollments.map((e) => e.studentId),
      })),
    );

    const input: TimetableEngineInput = {
      sections: toSchedule.map((s) => ({
        id: s.id,
        courseCode: s.course.code,
        enrollments: s.enrollments.length,
        instructorId: s.instructorId ?? undefined,
      })),
      rooms: rooms.map((r) => ({ id: r.id, capacity: r.capacity })),
      existing,
      studentOverlapGroups,
      facultyAvailability: opts?.facultyAvailability,
      maxOptions: opts?.maxOptions ?? 3,
    };

    return {
      semesterId,
      sectionsToSchedule: toSchedule.length,
      ...this.generate(input, opts?.constraints),
    };
  }

  async suggestWithNarrative(
    user: AuthUser,
    input: TimetableEngineInput,
    constraints?: string[],
  ): Promise<{
    options: TimetableEngineOption[];
    narrative?: string;
    constraintsApplied: ParsedTimetableConstraints;
    engine: 'csp';
    isAIGenerated: boolean;
  }> {
    const { options, constraintsApplied, engine } = this.generate(input, constraints);
    if (!options.length) {
      return { options, constraintsApplied, engine, isAIGenerated: false };
    }
    const narrative = await this.narrateOptions(user, options, constraintsApplied);
    return { options, narrative, constraintsApplied, engine, isAIGenerated: true };
  }

  async narrateOptions(
    user: AuthUser,
    options: TimetableEngineOption[],
    constraintsApplied: ParsedTimetableConstraints,
  ): Promise<string> {
    return this.ai.complete(user.institutionId, [
      {
        role: 'system',
        content:
          'Briefly compare timetabling options for a registrar. Mention room use, faculty balance, and trade-offs. Do not invent data.',
      },
      {
        role: 'user',
        content: JSON.stringify({
          constraints: constraintsApplied.notes,
          options: options.slice(0, 3),
        }),
      },
    ]);
  }

  private buildOverlapGroups(sections: Array<{ id: string; studentIds: string[] }>): string[][] {
    const groups: string[][] = [];
    for (let i = 0; i < sections.length; i++) {
      for (let j = i + 1; j < sections.length; j++) {
        const a = sections[i]!;
        const b = sections[j]!;
        const setB = new Set(b.studentIds);
        if (a.studentIds.some((id) => setB.has(id))) {
          groups.push([a.id, b.id]);
        }
      }
    }
    return groups;
  }

  /** Apply chosen option schedules to sections (human-selected). */
  async applyOption(user: AuthUser, option: TimetableEngineOption) {
    const roomIds = [...new Set(option.assignments.map((a) => a.roomId))];
    const roomRows = await this.prisma.room.findMany({
      where: { id: { in: roomIds }, institutionId: user.institutionId },
      select: { id: true, building: true, name: true },
    });
    const roomLabel = new Map(roomRows.map((r) => [r.id, `${r.building} / ${r.name}`]));

    for (const a of option.assignments) {
      await this.prisma.section.updateMany({
        where: { id: a.sectionId, institutionId: user.institutionId },
        data: {
          room: roomLabel.get(a.roomId) ?? a.roomId,
          schedule: {
            slots: [
              {
                day: a.day,
                startTime: a.startTime,
                endTime: a.endTime,
              },
            ],
          },
        },
      });
    }
    return { applied: option.assignments.length };
  }
}
