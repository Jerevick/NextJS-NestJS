import { Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class CreateEnrollmentDto {
  @IsString()
  studentId!: string;

  @IsString()
  sectionId!: string;

  /** When section is full, add student to waitlist instead of failing. */
  @IsOptional()
  @IsBoolean()
  waitlistIfFull?: boolean;

  /** When true with institution allowInterEntityEnrollment, enroll into a section outside the student’s entity (institution-wide staff only). */
  @IsOptional()
  @IsBoolean()
  allowInterEntity?: boolean;

  /** Phase 19 — academic repeat context for the enrolment row (Law P2). Defaults to first attempt. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  enrollmentAttemptNumber?: number;

  /** Optional link to the original semester academic period being repeated / referenced. */
  @IsOptional()
  @IsString()
  originalSemesterId?: string;
}
