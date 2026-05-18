import { IsDateString, IsEnum, IsInt, IsOptional, IsString, Min, MinLength } from 'class-validator';
import { MeetingStatus, MeetingType } from '@prisma/client';

export class UpdateMeetingDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  title?: string;

  @IsOptional()
  @IsEnum(MeetingType)
  type?: MeetingType;

  @IsOptional()
  @IsDateString()
  scheduledAt?: string;

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
  @IsEnum(MeetingStatus)
  status?: MeetingStatus;
}
