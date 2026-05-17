import { IsString } from 'class-validator';

export class CreateCarryoverEnrollmentDto {
  @IsString()
  studentId!: string;

  @IsString()
  originalEnrollmentId!: string;

  @IsString()
  repeatEnrollmentId!: string;
}
