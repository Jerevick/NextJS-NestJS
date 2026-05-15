import { IsObject, IsString, MinLength } from 'class-validator';

export class CreateGradeOverrideDto {
  @IsString()
  @MinLength(3)
  reason!: string;

  /** Proposed `StudentEnrollment.grade` JSON after approval (e.g. score, letterGrade, gradePoints, components). */
  @IsObject()
  newGrade!: Record<string, unknown>;
}
