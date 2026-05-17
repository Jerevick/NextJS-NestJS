import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class ListLmsCourseInstancesQueryDto {
  @IsOptional()
  @IsString()
  cursor?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @IsString()
  sectionId?: string;

  /** When true and the caller has a linked **`studentId`**, each course row includes **`studentSnapshot`**. */
  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined || value === null || value === '') {
      return undefined;
    }
    if (typeof value === 'boolean') {
      return value;
    }
    const s = String(value).toLowerCase();
    return s === '1' || s === 'true' || s === 'yes';
  })
  @IsBoolean()
  includeStudentSnapshot?: boolean;
}
