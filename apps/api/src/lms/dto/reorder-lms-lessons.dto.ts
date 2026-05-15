import { ArrayMinSize, IsArray, IsString } from 'class-validator';

export class ReorderLmsLessonsDto {
  /** Every non-deleted lesson id for this module, in the desired display order. */
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  lessonIds!: string[];
}
