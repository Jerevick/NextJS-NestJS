import { EmploymentType } from '@prisma/client';
import { IsArray, IsDateString, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateStaffProfileDto {
  @IsString()
  userId!: string;

  @IsString()
  @MinLength(1)
  staffNumber!: string;

  @IsString()
  orgUnitId!: string;

  @IsString()
  positionId!: string;

  @IsOptional()
  @IsEnum(EmploymentType)
  employmentType?: EmploymentType;

  @IsOptional()
  @IsDateString()
  contractStart?: string;

  @IsOptional()
  @IsDateString()
  contractEnd?: string;

  @IsOptional()
  @IsString()
  officeLocation?: string;

  @IsOptional()
  @IsArray()
  specializations?: string[];

  @IsOptional()
  @IsArray()
  researchInterests?: string[];
}
