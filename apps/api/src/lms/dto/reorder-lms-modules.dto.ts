import { ArrayMinSize, IsArray, IsString } from 'class-validator';

export class ReorderLmsModulesDto {
  /** Every non-deleted module id for this course instance, in the desired display order. */
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  moduleIds!: string[];
}
