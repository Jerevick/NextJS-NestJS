import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class AllocateLeaveBalanceDto {
  @IsString()
  staffId!: string;

  @IsString()
  leaveTypeId!: string;

  @IsString()
  academicYearId!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  allocated?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  carriedOver?: number;
}
