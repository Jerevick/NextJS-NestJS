import { IsOptional, IsString, MaxLength } from 'class-validator';

export class LiftEnrollmentHoldDto {
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  liftNotes?: string;
}
