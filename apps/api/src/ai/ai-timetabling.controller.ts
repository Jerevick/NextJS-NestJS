import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import type { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequireAnyPermissions } from '../common/decorators/require-any-permissions.decorator';
import { AnyPermissionsGuard } from '../common/guards/any-permissions.guard';
import {
  ApplyTimetableOptionDto,
  GenerateSemesterTimetableDto,
  GenerateTimetableDto,
} from './dto/generate-timetable.dto';
import { TimetablingService } from './timetabling.service';
import type { TimetableEngineInput, TimetableEngineOption } from './timetabling-engine.util';

@Controller('ai/timetabling')
@UseGuards(AnyPermissionsGuard)
export class AiTimetablingController {
  constructor(private readonly timetabling: TimetablingService) {}

  /**
   * AI Timetabling Assistant — sections, rooms, faculty availability, constraints
   * → multiple conflict-free options ranked by optimisation score.
   */
  @Post('generate')
  @RequireAnyPermissions('academic.write', 'enrollments.write')
  async generate(@CurrentUser() user: AuthUser, @Body() dto: GenerateTimetableDto) {
    const input: TimetableEngineInput = {
      sections: dto.sections,
      rooms: dto.rooms,
      facultyAvailability: dto.facultyAvailability,
      studentOverlapGroups: dto.studentOverlapGroups,
      maxOptions: dto.maxOptions,
    };
    if (dto.includeAiNarrative) {
      return this.timetabling.suggestWithNarrative(user, input, dto.constraints);
    }
    return this.timetabling.generate(input, dto.constraints);
  }

  @Post('generate/semester/:semesterId')
  @RequireAnyPermissions('academic.write', 'enrollments.write')
  async generateSemester(
    @CurrentUser() user: AuthUser,
    @Param('semesterId') semesterId: string,
    @Body() dto: GenerateSemesterTimetableDto,
  ) {
    if (dto.includeAiNarrative) {
      const base = await this.timetabling.generateForSemester(user, semesterId, dto.entityId, {
        onlyUnscheduled: dto.onlyUnscheduled ?? true,
        maxOptions: dto.maxOptions,
        constraints: dto.constraints,
        facultyAvailability: dto.facultyAvailability,
      });
      if (!base.options.length) return { ...base, isAIGenerated: false };
      const narrative = await this.timetabling.narrateOptions(
        user,
        base.options,
        base.constraintsApplied,
      );
      return { ...base, narrative, isAIGenerated: true };
    }
    return this.timetabling.generateForSemester(user, semesterId, dto.entityId, {
      onlyUnscheduled: dto.onlyUnscheduled ?? true,
      maxOptions: dto.maxOptions,
      constraints: dto.constraints,
      facultyAvailability: dto.facultyAvailability,
    });
  }

  /** Apply a human-selected option to section schedules. */
  @Post('apply')
  @RequireAnyPermissions('academic.write', 'enrollments.write')
  apply(@CurrentUser() user: AuthUser, @Body() dto: ApplyTimetableOptionDto) {
    return this.timetabling.applyOption(user, dto.option as unknown as TimetableEngineOption);
  }

  /** Alias — CSP engine + optional AI narrative comparing options. */
  @Post('suggest')
  @RequireAnyPermissions('academic.write', 'enrollments.write')
  suggest(@CurrentUser() user: AuthUser, @Body() dto: GenerateTimetableDto) {
    return this.timetabling.suggestWithNarrative(
      user,
      {
        sections: dto.sections,
        rooms: dto.rooms,
        facultyAvailability: dto.facultyAvailability,
        studentOverlapGroups: dto.studentOverlapGroups,
        maxOptions: dto.maxOptions ?? 3,
      },
      dto.constraints,
    );
  }
}
