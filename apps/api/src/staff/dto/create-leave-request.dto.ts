import { IsDateString, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateLeaveRequestDto {
  @IsString()
  staffId!: string;

  @IsString()
  leaveTypeId!: string;

  @IsString()
  academicYearId!: string;

  @IsDateString()
  startDate!: string;

  @IsDateString()
  endDate!: string;

  @IsString()
  @MinLength(3)
  reason!: string;

  @IsOptional()
  @IsString()
  coveringStaffId?: string;

  @IsOptional()
  @IsString()
  supportingDocKey?: string;
}
