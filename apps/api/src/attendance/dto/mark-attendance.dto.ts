import { IsDateString, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { AttendanceStatus } from '@prisma/client';

export class MarkAttendanceDto {
  @IsString()
  studentId!: string;

  @IsString()
  sectionId!: string;

  /** Calendar day (YYYY-MM-DD) or full ISO datetime; normalized to UTC midnight of that calendar day. */
  @IsDateString()
  sessionDate!: string;

  @IsEnum(AttendanceStatus)
  status!: AttendanceStatus;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
