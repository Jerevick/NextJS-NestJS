import { IsString, MinLength } from 'class-validator';

export class SelfCheckInAttendanceDto {
  @IsString()
  @MinLength(10)
  token!: string;
}
