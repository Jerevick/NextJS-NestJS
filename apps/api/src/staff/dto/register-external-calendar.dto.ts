import { IsEnum, IsOptional, IsString } from 'class-validator';

export enum ExternalCalendarProvider {
  GOOGLE = 'google',
  OUTLOOK = 'outlook',
  ICS = 'ics',
}

export class RegisterExternalCalendarDto {
  @IsEnum(ExternalCalendarProvider)
  provider!: ExternalCalendarProvider;

  @IsOptional()
  @IsString()
  externalEventId?: string;
}
