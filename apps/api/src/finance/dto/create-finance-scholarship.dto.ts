import { FinanceScholarshipType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateFinanceScholarshipDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name!: string;

  @IsEnum(FinanceScholarshipType)
  type!: FinanceScholarshipType;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  fundingSource!: string;

  @Type(() => Number)
  @Min(0)
  totalFund!: number;

  @IsOptional()
  @IsString()
  entityId?: string;

  @IsOptional()
  @IsString()
  applicationSchemaId?: string;
}

export class CreateScholarshipAwardDto {
  @IsUUID()
  studentId!: string;

  @IsUUID()
  academicYearId!: string;

  @Type(() => Number)
  @Min(0.01)
  amount!: number;

  @IsOptional()
  @IsString()
  entityId?: string;
}
