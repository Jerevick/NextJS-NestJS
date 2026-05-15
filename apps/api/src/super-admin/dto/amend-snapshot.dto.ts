import { Type } from 'class-transformer';
import { IsInt, IsString, Min, MinLength } from 'class-validator';

export class AmendSnapshotDto {
  @Type(() => Number)
  @IsInt()
  @Min(0)
  billableCount!: number;

  @IsString()
  @MinLength(10)
  reason!: string;
}
