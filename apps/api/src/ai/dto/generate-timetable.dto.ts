import { Type } from 'class-transformer';
import { IsArray, IsInt, IsOptional, IsString, Min, ValidateNested } from 'class-validator';

class TimetableSectionDto {
  @IsString()
  id!: string;

  @IsString()
  courseCode!: string;

  @IsInt()
  @Min(0)
  enrollments!: number;

  @IsOptional()
  @IsString()
  instructorId?: string;

  @IsOptional()
  @IsInt()
  @Min(15)
  durationMinutes?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  preferredDays?: string[];
}

class TimetableRoomDto {
  @IsString()
  id!: string;

  @IsInt()
  @Min(1)
  capacity!: number;
}

export class GenerateTimetableDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TimetableSectionDto)
  sections!: TimetableSectionDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TimetableRoomDto)
  rooms!: TimetableRoomDto[];

  @IsOptional()
  @IsArray()
  studentOverlapGroups?: string[][];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  constraints?: string[];

  @IsOptional()
  facultyAvailability?: Record<string, string[]>;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxOptions?: number;

  @IsOptional()
  includeAiNarrative?: boolean;
}

export class GenerateSemesterTimetableDto {
  @IsString()
  semesterId!: string;

  @IsOptional()
  @IsString()
  entityId?: string;

  @IsOptional()
  onlyUnscheduled?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  constraints?: string[];

  @IsOptional()
  facultyAvailability?: Record<string, string[]>;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxOptions?: number;

  @IsOptional()
  includeAiNarrative?: boolean;
}

export class ApplyTimetableOptionDto {
  @ValidateNested()
  @Type(() => Object)
  option!: {
    score: number;
    assignments: Array<{
      sectionId: string;
      courseCode: string;
      roomId: string;
      day: string;
      startTime: string;
      endTime: string;
      instructorId?: string;
    }>;
  };
}
