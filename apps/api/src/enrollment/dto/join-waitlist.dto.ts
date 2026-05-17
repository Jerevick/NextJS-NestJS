import { IsString } from 'class-validator';

export class JoinWaitlistDto {
  @IsString()
  studentId!: string;
}
