import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';
import { MeetingType } from '@prisma/client';

export class CreateMeetingDto {
  @IsString()
  @MinLength(2)
  title!: string;

  @IsEnum(MeetingType)
  type!: MeetingType;

  @IsString()
  convenerPositionId!: string;

  @IsString()
  orgUnitId!: string;

  @IsOptional()
  @IsString()
  committeeId?: string;

  @IsDateString()
  scheduledAt!: string;

  @IsOptional()
  @IsInt()
  @Min(15)
  durationMinutes?: number;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsString()
  meetingLink?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  quorumRequired?: number;

  @IsOptional()
  @IsBoolean()
  isConfidential?: boolean;
}
