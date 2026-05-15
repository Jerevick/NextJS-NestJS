import { IsString, MinLength } from 'class-validator';

export class CloneLmsCourseInstanceDto {
  /** Target section must belong to the same institution and must not already have an LMS instance. */
  @IsString()
  @MinLength(1)
  targetSectionId!: string;
}
