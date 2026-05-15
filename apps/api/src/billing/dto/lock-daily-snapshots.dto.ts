import { IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class LockDailySnapshotsDto {
  @IsString()
  institutionId!: string;

  @IsOptional()
  @IsString()
  entityId?: string;

  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  fromDate!: string;

  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  toDate!: string;

  @IsString()
  @MinLength(10)
  @MaxLength(2000)
  reason!: string;
}
