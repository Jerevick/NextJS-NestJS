import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsEmail,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateStudentDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsString()
  programId!: string;

  @IsString()
  @MaxLength(120)
  firstName!: string;

  @IsString()
  @MaxLength(120)
  lastName!: string;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  currentLevel?: number;

  @IsOptional()
  @IsDateString()
  admissionDate?: string;

  @IsOptional()
  @IsDateString()
  expectedGraduationDate?: string;

  @IsOptional()
  @IsString()
  entityId?: string;

  @IsOptional()
  @IsArray()
  guardians?: unknown[];

  @IsOptional()
  @IsArray()
  emergencyContacts?: unknown[];

  @IsOptional()
  @IsObject()
  specialNeeds?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  photo?: string;
}
