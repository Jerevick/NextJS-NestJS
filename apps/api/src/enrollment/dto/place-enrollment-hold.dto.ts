import { EnrollmentHoldType } from '@prisma/client';
import { IsEnum, IsString, MinLength } from 'class-validator';

export class PlaceEnrollmentHoldDto {
  @IsEnum(EnrollmentHoldType)
  type!: EnrollmentHoldType;

  @IsString()
  @MinLength(3)
  reason!: string;
}
