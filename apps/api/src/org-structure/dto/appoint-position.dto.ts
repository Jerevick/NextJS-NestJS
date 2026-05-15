import { IsBoolean, IsDateString, IsOptional, IsString } from 'class-validator';

export class AppointPositionDto {
  @IsString()
  userId!: string;

  @IsDateString()
  startDate!: string;

  @IsOptional()
  @IsBoolean()
  isActing?: boolean;

  @IsOptional()
  @IsString()
  delegatedBy?: string;
}
