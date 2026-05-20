import { IsEnum } from 'class-validator';

export class ReviewRegistrationRequestDto {
  @IsEnum(['REVIEWED', 'DISMISSED'])
  status!: 'REVIEWED' | 'DISMISSED';
}
